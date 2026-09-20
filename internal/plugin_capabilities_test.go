package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

// --- shared helpers (this file only; forms_test.go has its own similar
// closures scoped to TestFormsEndToEnd) ---

func newFormsTestHandler(t *testing.T, app *pocketbase.PocketBase) http.Handler {
	t.Helper()
	if err := RegisterForms(app, testFormsManifest(t)); err != nil {
		t.Fatal(err)
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.OnServe().Trigger(&core.ServeEvent{App: app, Router: router}); err != nil {
		t.Fatal(err)
	}
	handler, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return handler
}

func doRequest(t *testing.T, handler http.Handler, method, path, token string, body any, want int) *httptest.ResponseRecorder {
	t.Helper()
	payload, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.RemoteAddr = "192.0.2.1:1234"
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	if resp.Code != want {
		t.Fatalf("%s %s: got %d, want %d: %s", method, path, resp.Code, want, resp.Body.String())
	}
	return resp
}

func newSiteAdmin(t *testing.T, app *pocketbase.PocketBase, email string, site *core.Record) string {
	t.Helper()
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	user := core.NewRecord(users)
	user.SetEmail(email)
	user.SetPassword("test-password-1234")
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	assignments, err := app.FindCollectionByNameOrId("site_role_assignments")
	if err != nil {
		t.Fatal(err)
	}
	assignment := core.NewRecord(assignments)
	assignment.Set("user", user.Id)
	assignment.Set("site", site.Id)
	assignment.Set("role", "developer")
	if err := app.Save(assignment); err != nil {
		t.Fatal(err)
	}
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func installFormsPlugin(t *testing.T, handler http.Handler, siteId, token string, grantEmail bool) {
	t.Helper()
	doRequest(t, handler, "PUT", "/api/primo/sites/"+siteId+"/plugins/forms", token,
		map[string]any{"grant": map[string]bool{"email": grantEmail}}, 200)
}

// --- 1. Valid install + storage ---

func TestPluginInstall_GrantsDeclaredCapabilitiesAndEnablesStorage(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	handler := newFormsTestHandler(t, app)
	owner := newSiteAdmin(t, app, "owner1@example.com", site)

	resp := doRequest(t, handler, "PUT", "/api/primo/sites/"+site.Id+"/plugins/forms", owner,
		map[string]any{"grant": map[string]bool{"email": true}}, 200)
	var installed struct {
		Plugin       string   `json:"plugin"`
		Capabilities []string `json:"capabilities"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &installed); err != nil {
		t.Fatal(err)
	}
	if installed.Plugin != "forms" || len(installed.Capabilities) != 2 {
		t.Fatalf("expected forms plugin with 2 capabilities, got %#v", installed)
	}

	definition := FormDefinition{Version: 1, Name: "Contact", Enabled: true,
		Fields: []FormField{{Name: "email", Type: "email", Required: true}}}
	base := "/api/primo/sites/" + site.Id + "/forms/contact"
	doRequest(t, handler, "PUT", base, owner, definition, 200)

	submit := "/api/primo/forms/" + site.Id + "/contact/submit"
	doRequest(t, handler, "POST", submit, "",
		map[string]any{"requestId": "install-test-req-0001", "data": map[string]string{"email": "visitor@example.com"}}, 202)

	count, err := app.CountRecords("primo_form_submissions")
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected one stored submission, got %d", count)
	}
}

// --- 2. Denied storage without (or after revoking) the data capability ---

func TestFormSubmission_DeniedWithoutDataCapability(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	handler := newFormsTestHandler(t, app)
	owner := newSiteAdmin(t, app, "owner2@example.com", site)

	installFormsPlugin(t, handler, site.Id, owner, false)
	definition := FormDefinition{Version: 1, Name: "Contact", Enabled: true,
		Fields: []FormField{{Name: "email", Type: "email", Required: true}}}
	base := "/api/primo/sites/" + site.Id + "/forms/contact"
	doRequest(t, handler, "PUT", base, owner, definition, 200)

	submit := "/api/primo/forms/" + site.Id + "/contact/submit"
	okBody := map[string]any{"requestId": "revoke-test-req-00001", "data": map[string]string{"email": "visitor@example.com"}}
	doRequest(t, handler, "POST", submit, "", okBody, 202)

	// Revoke the plugin entirely (drops the `data` grant). The form
	// definition and the submission already stored must both survive —
	// only future storage is denied.
	doRequest(t, handler, "DELETE", "/api/primo/sites/"+site.Id+"/plugins/forms", owner, nil, 200)

	form, err := findForm(app, site.Id, "contact")
	if err != nil {
		t.Fatalf("form definition should survive uninstall: %v", err)
	}
	if form == nil {
		t.Fatal("form definition missing after uninstall")
	}
	countBefore, _ := app.CountRecords("primo_form_submissions")
	if countBefore != 1 {
		t.Fatalf("existing submission should survive uninstall, got count=%d", countBefore)
	}

	// A visitor must see this exactly like a form that was never
	// registered — never a leak of "plugin not installed" as distinct
	// from "form not found".
	newBody := map[string]any{"requestId": "revoke-test-req-00002", "data": map[string]string{"email": "second@example.com"}}
	doRequest(t, handler, "POST", submit, "", newBody, 404)

	countAfter, _ := app.CountRecords("primo_form_submissions")
	if countAfter != 1 {
		t.Fatalf("storage after revocation must be denied: count=%d", countAfter)
	}
}

// --- 3. Denied sending without, and after revoking, the email capability —
// including a notification that was already queued before revocation. ---

func TestNotificationDelivery_DeniedWithoutOrAfterRevokedEmailCapability(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	handler := newFormsTestHandler(t, app)
	owner := newSiteAdmin(t, app, "owner3@example.com", site)

	// Install with ONLY data granted — email declared by the manifest
	// (optional) but never granted for this site.
	installFormsPlugin(t, handler, site.Id, owner, false)
	definition := FormDefinition{Version: 1, Name: "Contact", Enabled: true,
		Fields:   []FormField{{Name: "email", Type: "email", Required: true}},
		NotifyTo: ""}
	base := "/api/primo/sites/" + site.Id + "/forms/contact"
	doRequest(t, handler, "PUT", base, owner, definition, 200)

	// Registering a form with notifyTo requires the email capability.
	withNotify := definition
	withNotify.NotifyTo = "owner3@example.com"
	doRequest(t, handler, "PUT", base, owner, withNotify, 400)

	// Now grant email, register with notifyTo, and submit — this queues a
	// pending notification.
	installFormsPlugin(t, handler, site.Id, owner, true)
	doRequest(t, handler, "PUT", base, owner, withNotify, 200)
	submit := "/api/primo/forms/" + site.Id + "/contact/submit"
	doRequest(t, handler, "POST", submit, "",
		map[string]any{"requestId": "notify-test-req-00001", "data": map[string]string{"email": "visitor@example.com"}}, 202)

	app.Settings().SMTP.Enabled = true
	calls := 0
	send := func(message *mailer.Message) error {
		calls++
		return nil
	}

	// Revoke email (keep data) BEFORE the queued job is ever delivered.
	installFormsPlugin(t, handler, site.Id, owner, false)

	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if calls != 0 {
		t.Fatalf("must not send once the site's email capability is revoked, got %d calls", calls)
	}
	records, err := app.FindAllRecords("primo_form_submissions")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected the submission to survive, got %d records", len(records))
	}
	if records[0].GetString("notification") != "pending" || records[0].GetInt("attempts") != 0 {
		t.Fatalf("a capability denial must not consume a retry attempt: notification=%q attempts=%d",
			records[0].GetString("notification"), records[0].GetInt("attempts"))
	}

	// Re-grant email: the same queued job now goes out on its own, with no
	// re-submission and no duplicate record.
	installFormsPlugin(t, handler, site.Id, owner, true)
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("expected exactly one send once email is re-granted, got %d", calls)
	}
	count, _ := app.CountRecords("primo_form_submissions")
	if count != 1 {
		t.Fatalf("resumed delivery must not duplicate the submission, got count=%d", count)
	}
}

// --- 3b. A backlog of revoked jobs at the front of the queue must not starve
// an authorized job on another site behind them. ---

func TestNotificationDelivery_RevokedBacklogDoesNotStarveOtherSites(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	handler := newFormsTestHandler(t, app)

	revokedSite := createImportTestSite(t, app)
	revokedOwner := newSiteAdmin(t, app, "revoked-owner@example.com", revokedSite)
	installFormsPlugin(t, handler, revokedSite.Id, revokedOwner, true)
	definition := FormDefinition{Version: 1, Name: "Contact", Enabled: true,
		Fields:   []FormField{{Name: "email", Type: "email", Required: true}},
		NotifyTo: "revoked-owner@example.com"}
	revokedBase := "/api/primo/sites/" + revokedSite.Id + "/forms/contact"
	doRequest(t, handler, "PUT", revokedBase, revokedOwner, definition, 200)

	revokedSubmit := "/api/primo/forms/" + revokedSite.Id + "/contact/submit"
	const revokedBacklog = 30
	for i := 0; i < revokedBacklog; i++ {
		doRequest(t, handler, "POST", revokedSubmit, "",
			map[string]any{"requestId": fmt.Sprintf("starve-test-req-%05d", i), "data": map[string]string{"email": "visitor@example.com"}}, 202)
	}
	// Revoke email after queuing, so every one of those jobs is now stuck
	// pending with an authorization gate, not a transient failure.
	installFormsPlugin(t, handler, revokedSite.Id, revokedOwner, false)

	otherSite := createImportTestSite(t, app)
	otherOwner := newSiteAdmin(t, app, "other-owner@example.com", otherSite)
	installFormsPlugin(t, handler, otherSite.Id, otherOwner, true)
	otherDefinition := definition
	otherBase := "/api/primo/sites/" + otherSite.Id + "/forms/contact"
	doRequest(t, handler, "PUT", otherBase, otherOwner, otherDefinition, 200)
	otherSubmit := "/api/primo/forms/" + otherSite.Id + "/contact/submit"
	doRequest(t, handler, "POST", otherSubmit, "",
		map[string]any{"requestId": "starve-test-other-req-01", "data": map[string]string{"email": "visitor@example.com"}}, 202)

	app.Settings().SMTP.Enabled = true
	var sentTo []string
	send := func(message *mailer.Message) error {
		sentTo = append(sentTo, message.To[0].Address)
		return nil
	}
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if len(sentTo) != 1 {
		t.Fatalf("expected the authorized job on the other site to be delivered despite a %d-job revoked backlog ahead of it, got %d sends: %#v",
			revokedBacklog, len(sentTo), sentTo)
	}

	otherRecords, err := app.FindRecordsByFilter("primo_form_submissions", "form.site = {:site}", "-created", 1, 0, dbx.Params{"site": otherSite.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(otherRecords) != 1 || otherRecords[0].GetString("notification") != "sent" {
		t.Fatal("expected the other site's submission to be marked sent")
	}

	revokedRecords, err := app.FindRecordsByFilter("primo_form_submissions", "form.site = {:site}", "created", revokedBacklog, 0, dbx.Params{"site": revokedSite.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(revokedRecords) != revokedBacklog {
		t.Fatalf("expected all %d revoked-site submissions to survive, got %d", revokedBacklog, len(revokedRecords))
	}
	for _, record := range revokedRecords {
		if record.GetString("notification") != "pending" || record.GetInt("attempts") != 0 {
			t.Fatalf("revoked job must stay pending with no consumed retry attempt: notification=%q attempts=%d",
				record.GetString("notification"), record.GetInt("attempts"))
		}
	}

	// Re-granting resumes the backlog on its own, with no re-submission.
	installFormsPlugin(t, handler, revokedSite.Id, revokedOwner, true)
	sentTo = nil
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if len(sentTo) != deliverFormNotificationsBatchSize {
		t.Fatalf("expected exactly one batch (%d) of the regranted backlog to send, got %d", deliverFormNotificationsBatchSize, len(sentTo))
	}
}

// --- 4. Visitor escalation is denied: no visitor-supplied grant, manifest,
// or plugin identity is ever accepted as authority. ---

func TestVisitor_CannotEscalatePrivilegeOrSupplyGrants(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	handler := newFormsTestHandler(t, app)
	owner := newSiteAdmin(t, app, "owner4@example.com", site)

	installFormsPlugin(t, handler, site.Id, owner, true)
	definition := FormDefinition{Version: 1, Name: "Contact", Enabled: true,
		Fields: []FormField{{Name: "email", Type: "email", Required: true}}}
	base := "/api/primo/sites/" + site.Id + "/forms/contact"
	doRequest(t, handler, "PUT", base, owner, definition, 200)

	// An anonymous visitor can never install, uninstall, or view plugin
	// grants for a site.
	doRequest(t, handler, "PUT", "/api/primo/sites/"+site.Id+"/plugins/forms", "", map[string]any{"grant": map[string]bool{"email": true}}, 401)
	doRequest(t, handler, "DELETE", "/api/primo/sites/"+site.Id+"/plugins/forms", "", nil, 401)
	doRequest(t, handler, "GET", "/api/primo/sites/"+site.Id+"/plugins/forms", "", nil, 401)

	// A submission body carrying anything beyond {data, requestId, website}
	// — including an attempt to smuggle a capability grant or plugin id —
	// is rejected outright by strict decoding, not silently ignored.
	submit := "/api/primo/forms/" + site.Id + "/contact/submit"
	escalation := map[string]any{
		"requestId": "escalate-test-req-0001",
		"data":      map[string]string{"email": "visitor@example.com"},
		"grant":     map[string]bool{"email": true},
	}
	doRequest(t, handler, "POST", submit, "", escalation, 400)

	escalation2 := map[string]any{
		"requestId": "escalate-test-req-0002",
		"data":      map[string]string{"email": "visitor@example.com"},
		"plugin_id": "forms",
		"manifest":  map[string]any{"requires": []string{"data", "email", "payments"}},
	}
	doRequest(t, handler, "POST", submit, "", escalation2, 400)

	// Confirm nothing from those rejected requests was stored.
	count, _ := app.CountRecords("primo_form_submissions")
	if count != 0 {
		t.Fatalf("rejected escalation attempts must not be stored, got count=%d", count)
	}
}

// --- 5. Cross-site isolation and install idempotency ---

func TestPluginInstallation_CrossSiteIsolationAndIdempotency(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	siteA := createImportTestSite(t, app)
	siteB := createImportTestSite(t, app)
	handler := newFormsTestHandler(t, app)
	ownerA := newSiteAdmin(t, app, "ownerA@example.com", siteA)
	ownerB := newSiteAdmin(t, app, "ownerB@example.com", siteB)

	// Site A grants only data; Site B grants data+email. Each site's admin
	// has no access to the other site at all.
	installFormsPlugin(t, handler, siteA.Id, ownerA, false)
	installFormsPlugin(t, handler, siteB.Id, ownerB, true)
	doRequest(t, handler, "PUT", "/api/primo/sites/"+siteB.Id+"/plugins/forms", ownerA, map[string]any{"grant": map[string]bool{"email": true}}, 403)

	grantedA, err := pluginCapabilityGranted(app, siteA.Id, formsPluginID, "email")
	if err != nil {
		t.Fatal(err)
	}
	if grantedA {
		t.Fatal("site A must not have email granted")
	}
	grantedB, err := pluginCapabilityGranted(app, siteB.Id, formsPluginID, "email")
	if err != nil {
		t.Fatal(err)
	}
	if !grantedB {
		t.Fatal("site B must have email granted")
	}

	// Idempotency: re-installing with the same grant twice more must not
	// create additional installation rows for either site.
	installFormsPlugin(t, handler, siteA.Id, ownerA, false)
	installFormsPlugin(t, handler, siteA.Id, ownerA, false)
	countA, err := app.CountRecords("primo_plugin_installations", dbx.HashExp{"site": siteA.Id, "plugin": "forms"})
	if err != nil {
		t.Fatal(err)
	}
	if countA != 1 {
		t.Fatalf("expected exactly one installation row for site A, got %d", countA)
	}

	total, err := app.CountRecords("primo_plugin_installations")
	if err != nil {
		t.Fatal(err)
	}
	if total != 2 {
		t.Fatalf("expected exactly one installation row per site (2 total), got %d", total)
	}
}

// --- 5b. An old persisted grant (including a migration backfill row written
// before any manifest ever existed) must not authorize a capability the
// currently loaded manifest no longer declares. ---

func TestPluginCapabilityGranted_RevokedByUpgradedManifestDroppingCapability(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	handler := newFormsTestHandler(t, app)
	owner := newSiteAdmin(t, app, "manifest-drift-owner@example.com", site)

	// Install normally against the real (email-declaring) manifest, so the
	// site has a genuinely, contract-validated "email" grant persisted —
	// indistinguishable from what the migration backfill would have written.
	installFormsPlugin(t, handler, site.Id, owner, true)
	granted, err := pluginCapabilityGranted(app, site.Id, formsPluginID, "email")
	if err != nil {
		t.Fatal(err)
	}
	if !granted {
		t.Fatal("email should be granted while the manifest still declares it")
	}

	// Simulate an upgraded embedded manifest that has dropped email — restore
	// the real cache afterwards so other tests in this package aren't
	// affected by this process-wide cache.
	previous := currentlyDeclaredCapabilities[formsPluginID]
	t.Cleanup(func() { currentlyDeclaredCapabilities[formsPluginID] = previous })
	currentlyDeclaredCapabilities[formsPluginID] = map[string]bool{"data": true}

	granted, err = pluginCapabilityGranted(app, site.Id, formsPluginID, "email")
	if err != nil {
		t.Fatal(err)
	}
	if granted {
		t.Fatal("an old persisted email grant must not authorize once the loaded manifest no longer declares email")
	}

	// And the notification worker must actually refuse to send for it, not
	// just report ungranted in isolation.
	app.Settings().SMTP.Enabled = true
	definition := FormDefinition{Version: 1, Name: "Contact", Enabled: true,
		Fields:   []FormField{{Name: "email", Type: "email", Required: true}},
		NotifyTo: "manifest-drift-owner@example.com"}
	base := "/api/primo/sites/" + site.Id + "/forms/contact"
	// Registering with notifyTo still requires email to be granted at
	// registration; re-enable the real manifest briefly to set up the form
	// and queue a submission, then re-apply the drifted manifest to prove
	// delivery (not just registration) is blocked.
	currentlyDeclaredCapabilities[formsPluginID] = previous
	doRequest(t, handler, "PUT", base, owner, definition, 200)
	submit := "/api/primo/forms/" + site.Id + "/contact/submit"
	doRequest(t, handler, "POST", submit, "",
		map[string]any{"requestId": "manifest-drift-req-00001", "data": map[string]string{"email": "visitor@example.com"}}, 202)
	currentlyDeclaredCapabilities[formsPluginID] = map[string]bool{"data": true}

	calls := 0
	send := func(message *mailer.Message) error {
		calls++
		return nil
	}
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if calls != 0 {
		t.Fatalf("must not send once the loaded manifest no longer declares email, got %d calls", calls)
	}
}

// --- 6. Conformance: Go enforces the real TS capability contract, not a
// hand-written duplicate. ---

func TestPluginContract_MatchesRealManifestAndRejectsUndeclaredCapability(t *testing.T) {
	contract, err := loadPluginContract(testFormsManifest(t))
	if err != nil {
		t.Fatalf("the shipped forms manifest must pass the real PluginManifest schema: %v", err)
	}
	if !contract.Parsed.declares("data") {
		t.Fatal("forms manifest must declare data")
	}
	if !contract.Parsed.declares("email") {
		t.Fatal("forms manifest must declare email")
	}
	requiredCaps := contract.Parsed.requiredCapabilities()
	if len(requiredCaps) != 1 || requiredCaps[0] != "data" {
		t.Fatalf("expected only data to be required, got %#v", requiredCaps)
	}
	optionalCaps := contract.Parsed.optionalCapabilities()
	if len(optionalCaps) != 1 || optionalCaps[0] != "email" {
		t.Fatalf("expected only email to be optional, got %#v", optionalCaps)
	}
	if err := contract.authorize("data", "insert"); err != nil {
		t.Fatalf("primo.data.insert must be authorized for forms: %v", err)
	}
	if err := contract.authorize("email", "send"); err != nil {
		t.Fatalf("primo.email.send must be authorized for forms: %v", err)
	}

	// A manifest that drifts away from declaring email must fail the exact
	// same authorization Go uses at install time — proving the check is
	// live against the real schema/runtime, not a Go-side stand-in that
	// could silently diverge from it.
	drifted := []byte(`{"id":"forms","name":"Forms","version":"1.0.0","requires":[{"capability":"data"}]}`)
	driftedContract, err := loadPluginContract(drifted)
	if err != nil {
		t.Fatalf("a manifest missing email (but otherwise valid) must still parse: %v", err)
	}
	if err := driftedContract.authorize("email", "send"); err == nil {
		t.Fatal("expected authorize(email, send) to fail once the manifest no longer declares email")
	}

	// A capability outside the closed set the TS contract recognizes must
	// also be rejected — proves Go isn't just checking manifest self-
	// consistency but the real capability table too.
	unknown := []byte(`{"id":"forms","name":"Forms","version":"1.0.0","requires":[{"capability":"not_a_real_capability"}]}`)
	if _, err := loadPluginContract(unknown); err == nil {
		t.Fatal("expected an unknown capability id to fail PluginManifest validation")
	}

	// And outright malformed JSON must fail cleanly rather than panic.
	if _, err := loadPluginContract([]byte("{not json")); err == nil {
		t.Fatal("expected malformed manifest JSON to fail")
	}
}
