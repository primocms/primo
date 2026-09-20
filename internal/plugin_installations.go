package internal

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// authorizeSiteAdmin is the shared authorization boundary for authenticated,
// site-scoped admin routes: registering a form and installing/uninstalling a
// plugin both require it. It mirrors the site's own updateRule — anyone who
// could edit the site (owner, developer, or a server role) can manage the
// plugins installed on it. Deliberately no localhost exemption: an
// unauthenticated caller must never manage a site's plugin grants.
func authorizeSiteAdmin(e *core.RequestEvent) (*core.Record, error) {
	if e.Auth == nil {
		return nil, e.UnauthorizedError("Sign in to manage this site", nil)
	}
	site, err := e.App.FindRecordById("sites", e.Request.PathValue("siteId"))
	if err != nil {
		return nil, e.NotFoundError("Site not found", nil)
	}
	info, err := e.RequestInfo()
	if err != nil {
		return nil, err
	}
	allowed, err := e.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
	if err != nil || !allowed {
		return nil, e.ForbiddenError("Access denied", nil)
	}
	return site, nil
}

func findPluginInstallation(app core.App, siteId, pluginId string) (*core.Record, error) {
	return app.FindFirstRecordByFilter(
		"primo_plugin_installations",
		"site = {:site} && plugin = {:plugin}",
		dbx.Params{"site": siteId, "plugin": pluginId},
	)
}

// pluginCapabilityGranted is the runtime enforcement boundary used on every
// hot path (anonymous submit, per-minute notification delivery): has THIS
// site currently granted THIS capability to THIS plugin. This is distinct
// from — and in addition to — "does the plugin's manifest declare the
// capability at all", which is checked once, at install time, against the
// real TS contract (see pluginContract.authorize). A missing installation —
// never installed, or explicitly uninstalled — grants nothing, so storage and
// sending fail closed rather than open. Checked fresh on every call (no
// caching of the persisted grant) so a revocation takes effect immediately,
// including for already-queued notification jobs.
//
// A persisted grant alone is not sufficient: it was written by whatever
// manifest was loaded at the time (including the plugin_installations
// migration backfill, which predates any manifest check at all). If the
// binary is later deployed with a manifest that no longer declares a
// capability, an old stored grant for it must stop authorizing anything —
// enforced here as an intersection with capabilityCurrentlyDeclared, which is
// derived once at startup from the actual shared contract, not re-parsed per
// request.
func pluginCapabilityGranted(app core.App, siteId, pluginId, capability string) (bool, error) {
	if !capabilityCurrentlyDeclared(pluginId, capability) {
		return false, nil
	}
	record, err := findPluginInstallation(app, siteId, pluginId)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var granted []string
	if err := record.UnmarshalJSONField("capabilities", &granted); err != nil {
		return false, err
	}
	for _, c := range granted {
		if c == capability {
			return true, nil
		}
	}
	return false, nil
}

// RegisterPluginInstallations adds the site-scoped plugin install/uninstall/
// status routes. Anonymous visitors never reach these — every handler goes
// through authorizeSiteAdmin first, and a visitor-supplied plugin identity or
// grant is never accepted anywhere else (submitForm resolves the plugin and
// its capabilities itself, from the URL's siteId and the server's own
// embedded manifest, never from request body content).
func RegisterPluginInstallations(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.PUT("/api/primo/sites/{siteId}/plugins/{pluginId}", installPlugin)
		e.Router.DELETE("/api/primo/sites/{siteId}/plugins/{pluginId}", uninstallPlugin)
		e.Router.GET("/api/primo/sites/{siteId}/plugins/{pluginId}", getPluginInstallation)
		return e.Next()
	})
	return nil
}

func readOptionalJSON(e *core.RequestEvent, target any) error {
	if e.Request.Body == nil {
		return nil
	}
	e.Request.Body = http.MaxBytesReader(e.Response, e.Request.Body, 4096)
	raw, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.BadRequestError("Could not read request body", nil)
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return e.BadRequestError("Invalid JSON body", nil)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return e.BadRequestError("Expected a single JSON object", nil)
	}
	return nil
}

// installPlugin validates the plugin's manifest against the real capability
// contract, computes the capability set this site is granting (every
// required capability, plus any optional one the caller explicitly opts
// into), cross-checks each against the contract's authorize_invocation for
// the method forms.go actually calls, and persists that as the site's
// authoritative installed configuration. Re-installing (e.g. to add/drop an
// optional capability) updates the existing row in place; it never touches
// primo_forms or primo_form_submissions, so re-registering doesn't lose data.
func installPlugin(e *core.RequestEvent) error {
	site, err := authorizeSiteAdmin(e)
	if err != nil {
		return err
	}
	pluginId := e.Request.PathValue("pluginId")
	manifestJSON, ok := pluginManifestJSONFor(pluginId)
	if !ok {
		return e.NotFoundError("Unknown plugin", nil)
	}

	var body struct {
		Grant map[string]bool `json:"grant"`
	}
	if err := readOptionalJSON(e, &body); err != nil {
		return err
	}

	contract, err := loadPluginContract(manifestJSON)
	if err != nil {
		e.App.Logger().Error("Plugin contract validation failed", "plugin", pluginId, "error", err)
		return e.InternalServerError("Plugin manifest failed capability contract validation", nil)
	}

	optional := map[string]bool{}
	for _, capability := range contract.Parsed.optionalCapabilities() {
		optional[capability] = true
	}
	for capability := range body.Grant {
		if !optional[capability] {
			return e.BadRequestError(fmt.Sprintf("%q is not an optional capability this plugin declares", capability), nil)
		}
	}

	final := map[string]bool{}
	for _, capability := range contract.Parsed.requiredCapabilities() {
		final[capability] = true
	}
	for capability := range optional {
		if body.Grant[capability] {
			final[capability] = true
		}
	}

	for capability := range final {
		method, known := formsCapabilityMethods[capability]
		if !known {
			return e.InternalServerError(fmt.Sprintf("plugin %q declares capability %q with no server-side handler", pluginId, capability), nil)
		}
		if err := contract.authorize(capability, method); err != nil {
			e.App.Logger().Error("Plugin capability contract check failed", "plugin", pluginId, "capability", capability, "error", err)
			return e.InternalServerError("Plugin manifest failed capability contract validation", nil)
		}
	}

	capabilities := make([]string, 0, len(final))
	for capability := range final {
		capabilities = append(capabilities, capability)
	}
	sort.Strings(capabilities)

	record, err := findPluginInstallation(e.App, site.Id, pluginId)
	if errors.Is(err, sql.ErrNoRows) {
		collection, err := e.App.FindCollectionByNameOrId("primo_plugin_installations")
		if err != nil {
			return err
		}
		record = core.NewRecord(collection)
		record.Set("site", site.Id)
		record.Set("plugin", pluginId)
	} else if err != nil {
		return err
	}
	record.Set("capabilities", capabilities)
	if err := e.App.Save(record); err != nil {
		return e.InternalServerError("Could not save plugin installation", err)
	}
	return e.JSON(200, map[string]any{"plugin": pluginId, "capabilities": capabilities})
}

// uninstallPlugin revokes every capability this site had granted the plugin.
// It deletes only the installation row — primo_forms and
// primo_form_submissions are untouched, so existing form definitions and
// collected submissions are preserved, not abandoned. Anonymous submission
// and notification sending both re-check the (now missing) installation on
// their own next request/delivery cycle, so revocation is immediate rather
// than waiting on a cache.
func uninstallPlugin(e *core.RequestEvent) error {
	site, err := authorizeSiteAdmin(e)
	if err != nil {
		return err
	}
	pluginId := e.Request.PathValue("pluginId")
	record, err := findPluginInstallation(e.App, site.Id, pluginId)
	if errors.Is(err, sql.ErrNoRows) {
		return e.JSON(200, map[string]any{"plugin": pluginId, "capabilities": []string{}})
	}
	if err != nil {
		return err
	}
	if err := e.App.Delete(record); err != nil {
		return e.InternalServerError("Could not remove plugin installation", err)
	}
	return e.JSON(200, map[string]any{"plugin": pluginId, "capabilities": []string{}})
}

func getPluginInstallation(e *core.RequestEvent) error {
	site, err := authorizeSiteAdmin(e)
	if err != nil {
		return err
	}
	pluginId := e.Request.PathValue("pluginId")
	e.Response.Header().Set("Cache-Control", "no-store")
	record, err := findPluginInstallation(e.App, site.Id, pluginId)
	if errors.Is(err, sql.ErrNoRows) {
		return e.JSON(200, map[string]any{"plugin": pluginId, "installed": false, "capabilities": []string{}})
	}
	if err != nil {
		return err
	}
	var capabilities []string
	if err := record.UnmarshalJSONField("capabilities", &capabilities); err != nil {
		return err
	}
	return e.JSON(200, map[string]any{"plugin": pluginId, "installed": true, "capabilities": capabilities})
}
