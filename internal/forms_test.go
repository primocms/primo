package internal

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

// TestPluginInstallationsMigration_BackfillsExistingFormsAndSubmissions
// re-runs the plugin_installations migration's Up function directly (found
// by filename in core.AppMigrations, the same list RunAppMigrations already
// applied it from once for this fresh app) against a site that has a form
// and a submission but no primo_plugin_installations row — the exact shape
// of a production database that registered forms before the plugin system
// existed. A test that only checks a fresh, empty database would never catch
// a backfill query that assumes it's the only row for that site, or that
// silently no-ops when a row already exists for unrelated reasons.
func TestPluginInstallationsMigration_BackfillsExistingFormsAndSubmissions(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	if err := registerCurrentlyDeclaredCapabilities(formsPluginID, testFormsManifest(t)); err != nil {
		t.Fatal(err)
	}
	site := createImportTestSite(t, app)

	formsCollection, err := app.FindCollectionByNameOrId("primo_forms")
	if err != nil {
		t.Fatal(err)
	}
	form := core.NewRecord(formsCollection)
	form.Set("site", site.Id)
	form.Set("slug", "contact")
	form.Set("definition", FormDefinition{Version: 1, Name: "Contact", Enabled: true,
		Fields: []FormField{{Name: "email", Type: "email", Required: true}}})
	if err := app.Save(form); err != nil {
		t.Fatalf("seed preexisting form: %v", err)
	}

	submissionsCollection, err := app.FindCollectionByNameOrId("primo_form_submissions")
	if err != nil {
		t.Fatal(err)
	}
	submission := core.NewRecord(submissionsCollection)
	submission.Set("form", form.Id)
	submission.Set("request_key", "preexisting-request-key-01")
	submission.Set("data", map[string]string{"email": "visitor@example.com"})
	submission.Set("notification", "off")
	if err := app.Save(submission); err != nil {
		t.Fatalf("seed preexisting submission: %v", err)
	}

	// This app's RunAppMigrations already applied plugin_installations once
	// (finding no forms yet, since the site/form above were created after).
	// Delete that no-op row so re-running Up mirrors a real upgrade: a
	// database with existing forms/submissions but no installation row yet.
	existing, err := findPluginInstallation(app, site.Id, formsPluginID)
	if err == nil {
		if err := app.Delete(existing); err != nil {
			t.Fatalf("remove no-op installation row: %v", err)
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		t.Fatal(err)
	}

	var migrationUp func(core.App) error
	for _, item := range core.AppMigrations.Items() {
		if item.File == "1789900000_plugin_installations.go" {
			migrationUp = item.Up
			break
		}
	}
	if migrationUp == nil {
		t.Fatal("plugin_installations migration not found in core.AppMigrations")
	}
	if err := migrationUp(app); err != nil {
		t.Fatalf("re-run plugin_installations migration backfill: %v", err)
	}

	granted, err := pluginCapabilityGranted(app, site.Id, formsPluginID, "data")
	if err != nil {
		t.Fatal(err)
	}
	if !granted {
		t.Fatal("backfill must grant data to a site with a preexisting form")
	}
	grantedEmail, err := pluginCapabilityGranted(app, site.Id, formsPluginID, "email")
	if err != nil {
		t.Fatal(err)
	}
	if !grantedEmail {
		t.Fatal("backfill must grant email to a site with a preexisting form, matching prior implicit behavior")
	}

	// The preexisting form and submission themselves must be untouched.
	reloadedForm, err := findForm(app, site.Id, "contact")
	if err != nil || reloadedForm == nil {
		t.Fatalf("preexisting form must survive the backfill: %v", err)
	}
	count, err := app.CountRecords("primo_form_submissions")
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("preexisting submission must survive the backfill, got count=%d", count)
	}
}

// testFormsManifest reads the real plugins/forms/manifest.json (go test's
// working directory is the package directory, so "../plugins/..." resolves
// from internal/) rather than a copy, so Go tests exercise the exact same
// file the TS capability-contract test (tests/integration/plugin-capabilities.test.mjs)
// validates.
func testFormsManifest(t *testing.T) []byte {
	t.Helper()
	manifest, err := os.ReadFile("../plugins/forms/manifest.json")
	if err != nil {
		t.Fatalf("read forms manifest: %v", err)
	}
	return manifest
}

func TestFormsEndToEnd(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
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
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	tokenFor := func(email, role string) string {
		t.Helper()
		record := core.NewRecord(users)
		record.SetEmail(email)
		record.SetPassword("test-password-1234")
		record.Set("serverRole", role)
		if err := app.Save(record); err != nil {
			t.Fatal(err)
		}
		token, err := record.NewAuthToken()
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	owner := tokenFor("owner@example.com", "")
	ownerRecord, err := app.FindFirstRecordByData("users", "email", "owner@example.com")
	if err != nil {
		t.Fatal(err)
	}
	assignments, err := app.FindCollectionByNameOrId("site_role_assignments")
	if err != nil {
		t.Fatal(err)
	}
	assignment := core.NewRecord(assignments)
	assignment.Set("user", ownerRecord.Id)
	assignment.Set("site", site.Id)
	assignment.Set("role", "developer")
	if err := app.Save(assignment); err != nil {
		t.Fatal(err)
	}
	site.Set("host", "forms-test.localhost")
	site.Set("name", "Forms Test")
	if err := app.Save(site); err != nil {
		t.Fatal(err)
	}
	otherSite := createImportTestSite(t, app)
	outsider := tokenFor("outsider@example.com", "")
	request := func(method, path, token string, body any, want int) *httptest.ResponseRecorder {
		t.Helper()
		payload, _ := json.Marshal(body)
		req := httptest.NewRequest(method, path, bytes.NewReader(payload))
		req.RemoteAddr = "192.0.2.1:1234"
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", token)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != want {
			t.Fatalf("%s %s: got %d, want %d: %s", method, path, response.Code, want, response.Body.String())
		}
		return response
	}
	base := "/api/primo/sites/" + site.Id + "/forms/contact"
	definition := FormDefinition{Version: 1, Name: "Contact", Enabled: true, Fields: []FormField{{Name: "email", Type: "email", Required: true}, {Name: "message", Type: "text", MaxLength: 100}}, NotifyTo: "owner@example.com"}
	// A form can't be registered before the plugin is installed for the site.
	request("PUT", base, owner, definition, 403)
	install := "/api/primo/sites/" + site.Id + "/plugins/forms"
	request("PUT", install, "", nil, 401)
	request("PUT", install, outsider, nil, 403)
	installResponse := request("PUT", install, owner, map[string]any{"grant": map[string]bool{"email": true}}, 200)
	if !strings.Contains(installResponse.Body.String(), "\"data\"") || !strings.Contains(installResponse.Body.String(), "\"email\"") {
		t.Fatalf("expected data+email granted, got %s", installResponse.Body.String())
	}
	request("PUT", base, "", definition, 401)
	request("PUT", base, outsider, definition, 403)
	request("PUT", base, owner, definition, 200)
	request("PUT", "/api/primo/sites/"+otherSite.Id+"/forms/contact", owner, definition, 403)
	submit := "/api/primo/forms/" + site.Id + "/contact/submit"
	body := map[string]any{"requestId": "request_1234567890", "data": map[string]string{"email": "visitor@example.com", "message": "Hello"}}
	request("POST", submit, "", body, 202)
	request("POST", submit, "", body, 202)
	count, _ := app.CountRecords("primo_form_submissions")
	if count != 1 {
		t.Fatalf("duplicate submission: %d", count)
	}
	request("GET", base+"/submissions", "", nil, 401)
	request("GET", base+"/submissions", outsider, nil, 403)
	response := request("GET", base+"/submissions", owner, nil, 200)
	if !strings.Contains(response.Body.String(), "Hello") {
		t.Fatal("submission missing from inbox")
	}
	// Collection API cannot bypass scoped routes.
	request("GET", "/api/collections/primo_form_submissions/records", "", nil, 403)
	// Unknown fields, invalid email, mismatched retry, honeypot, and disabled form.
	body["data"] = map[string]string{"email": "bad"}
	request("POST", submit, "", body, 400)
	body["data"] = map[string]string{"email": "visitor@example.com", "notifyTo": "attacker@example.com"}
	request("POST", submit, "", body, 400)
	body["data"] = map[string]string{"email": "visitor@example.com", "message": "Different"}
	request("POST", submit, "", body, 400)
	body["website"] = "spam"
	request("POST", submit, "", body, 202)
	count, _ = app.CountRecords("primo_form_submissions")
	if count != 1 {
		t.Fatal("honeypot persisted")
	}
	definition.Enabled = false
	request("PUT", base, owner, definition, 200)
	request("POST", submit, "", body, 404)
	count, _ = app.CountRecords("primo_form_submissions")
	if count != 1 {
		t.Fatal("update lost data")
	}
	// Notifications remain durable while SMTP is absent, then retry independently.
	calls := 0
	send := func(message *mailer.Message) error {
		calls++
		if message.To[0].Address != "owner@example.com" {
			t.Fatal("recipient changed")
		}
		if calls == 1 {
			return errors.New("SMTP unavailable")
		}
		return nil
	}
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if calls != 0 {
		t.Fatal("attempted delivery without SMTP")
	}
	app.Settings().SMTP.Enabled = true
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	records, _ := app.FindAllRecords("primo_form_submissions")
	record := records[0]
	if record.GetString("notification") != "pending" || record.GetInt("attempts") != 1 {
		t.Fatal("failed notification not retained for retry")
	}
	record.Set("next_attempt", time.Now().UTC().Add(-time.Minute))
	if err := app.Save(record); err != nil {
		t.Fatal(err)
	}
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if err := deliverFormNotifications(app, send); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatalf("unexpected delivery attempts: %d", calls)
	}
	count, _ = app.CountRecords("primo_form_submissions")
	if count != 1 {
		t.Fatal("notification retry duplicated data")
	}
}

func TestFormValidation(t *testing.T) {
	definition := FormDefinition{Version: 1, Name: "Test", Fields: []FormField{{Name: "name", Type: "text", Required: true, MaxLength: 3}}}
	if err := definition.validate(); err != nil {
		t.Fatal(err)
	}
	for _, data := range []map[string]string{{}, {"name": "long"}, {"name": "ok", "admin": "true"}} {
		if _, err := definition.validateData(data); err == nil {
			t.Fatalf("accepted invalid data: %#v", data)
		}
	}
	if _, err := definition.validateData(map[string]string{"name": "你好"}); err != nil {
		t.Fatal(err)
	}
	definition.Fields = append(definition.Fields, definition.Fields[0])
	if err := definition.validate(); err == nil {
		t.Fatal("duplicate fields accepted")
	}
}
