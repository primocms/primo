package internal

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func publicationHTTP(t *testing.T, app *pocketbase.PocketBase) (http.Handler, string) {
	t.Helper()
	if err := RegisterGenerateEndpoint(app); err != nil {
		t.Fatal(err)
	}
	if err := ServeSites(app); err != nil {
		t.Fatal(err)
	}
	return pushTestHTTP(t, app)
}

func publicationRequest(method, url, token, body string) *http.Request {
	request := httptest.NewRequest(method, url, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", token)
	}
	return request
}

func compiledHome(t *testing.T, app *pocketbase.PocketBase, site *core.Record, html string) {
	t.Helper()
	pages, err := app.FindRecordsByFilter("pages", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(pages) != 1 {
		t.Fatalf("pages: %v %v", pages, err)
	}
	file, err := filesystem.NewFileFromBytes([]byte(html), "index.html")
	if err != nil {
		t.Fatal(err)
	}
	pages[0].Set("compiled_html", file)
	if err := app.Save(pages[0]); err != nil {
		t.Fatal(err)
	}
}

func publishedBody(t *testing.T, handler http.Handler, host string) string {
	t.Helper()
	request := httptest.NewRequest("GET", "http://"+host+"/", nil)
	response := pushHTTP(t, handler, request, 200)
	return response.Body.String()
}

func TestPublicationAtomicActivationAndFailure(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, _ := pushFixture(t, app)
	handler, token := publicationHTTP(t, app)
	// Legacy published output remains available while the first tracked build runs.
	compiledHome(t, app, site, "<h1>Old public version</h1>")
	if err := GenerateSite(app, site); err != nil {
		t.Fatal(err)
	}
	revision := mustPushState(t, app, site.Id).Revision
	attempt, err := startPublication(app, site.Id, revision)
	if err != nil {
		t.Fatal(err)
	}
	attemptID := attempt.GetString("attempt_id")
	compiledHome(t, app, site, "<h1>New public version</h1>")
	if mustPushState(t, app, site.Id).Revision != revision {
		t.Fatal("compilation invalidated draft baseline")
	}
	if got := publishedBody(t, handler, site.GetString("host")); !strings.Contains(got, "Old public version") {
		t.Fatal(got)
	}
	url := "/api/primo/publication/" + site.Id
	status := pushHTTP(t, handler, publicationRequest("GET", url, token, ""), 200)
	if !strings.Contains(status.Body.String(), `"state":"publishing"`) {
		t.Fatal(status.Body.String())
	}
	pushHTTP(t, handler, publicationRequest("POST", url+"/"+attemptID+"/activate", token, "{}"), 200)
	if got := publishedBody(t, handler, site.GetString("host")); !strings.Contains(got, "New public version") {
		t.Fatal(got)
	}
	active, _ := publicationRecord(app, site.Id)
	if active.GetString("published_revision") != revision || active.GetString("prefix") == "" {
		t.Fatal("missing active publication")
	}
	// Repeating activation after a lost response is idempotent.
	pushHTTP(t, handler, publicationRequest("POST", url+"/"+attemptID+"/activate", token, "{}"), 200)
	// A stale failure report must not mark a successful attempt failed.
	pushHTTP(t, handler, publicationRequest("POST", url+"/"+attemptID+"/fail", token, `{"error":"lost response"}`), 200)
	active, _ = publicationRecord(app, site.Id)
	if active.GetString("attempt_state") != "succeeded" {
		t.Fatal("late failure undid success")
	}
	// Editing the CMS changes status to behind without changing public output.
	entry.Set("value", "New draft")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	value, err := publicationStatus(app, site)
	if err != nil || value["state"] != "behind" || value["unpublished_changes"] != true {
		t.Fatalf("status: %v, %v", value, err)
	}
	oldPrefix := active.GetString("prefix")
	attempt, err = startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision)
	if err != nil {
		t.Fatal(err)
	}
	// Missing generated source causes generation to fail; the active pointer and
	// the previous published revision must remain untouched.
	pages, _ := app.FindRecordsByFilter("pages", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	pages[0].Set("compiled_html", "")
	if err := app.Save(pages[0]); err != nil {
		t.Fatal(err)
	}
	failedID := attempt.GetString("attempt_id")
	pushHTTP(t, handler, publicationRequest("POST", url+"/"+failedID+"/activate", token, "{}"), 500)
	active, _ = publicationRecord(app, site.Id)
	if active.GetString("prefix") != oldPrefix || active.GetString("published_revision") != revision || active.GetString("attempt_state") != "failed" {
		t.Fatal("failed build changed active publication")
	}
	if got := publishedBody(t, handler, site.GetString("host")); !strings.Contains(got, "New public version") {
		t.Fatal(got)
	}
}

func TestPublicationRevisionAuthAndConcurrency(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, _ := pushFixture(t, app)
	handler, token := publicationHTTP(t, app)
	url := "/api/primo/publication/" + site.Id
	revision := mustPushState(t, app, site.Id).Revision
	pushHTTP(t, handler, publicationRequest("GET", url, "", ""), 403)
	pushHTTP(t, handler, publicationRequest("POST", url, "", `{"expected_revision":"`+revision+`"}`), 403)
	pushHTTP(t, handler, publicationRequest("POST", url, token, `{}`), 428)
	response := pushHTTP(t, handler, publicationRequest("POST", url, token, `{"expected_revision":"`+revision+`"}`), 200)
	value := map[string]string{}
	if err := json.Unmarshal(response.Body.Bytes(), &value); err != nil {
		t.Fatal(err)
	}
	attemptID := value["attempt_id"]
	pushHTTP(t, handler, publicationRequest("POST", url, token, `{"expected_revision":"`+revision+`"}`), 409)
	entry.Set("value", "Concurrent CMS edit")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	pushHTTP(t, handler, publicationRequest("POST", url+"/"+attemptID+"/activate", token, `{}`), 409)
	record, _ := publicationRecord(app, site.Id)
	if record.GetString("published_revision") != "" {
		t.Fatal("stale draft activated")
	}
	// A new attempt may retry after a failure, but delayed responses from the old
	// attempt cannot change the new one.
	newAttempt, err := startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision)
	if err != nil {
		t.Fatal(err)
	}
	if err := failPublication(app, site.Id, attemptID, "old failure"); err != nil {
		t.Fatal(err)
	}
	record, _ = publicationRecord(app, site.Id)
	if record.GetString("attempt_id") != newAttempt.GetString("attempt_id") || record.GetString("attempt_state") != "publishing" {
		t.Fatal("old failure changed new attempt")
	}
	record.Set("attempt_started_at", time.Now().Add(-publicationLease-time.Second).UTC().Format(time.RFC3339Nano))
	if err := app.Save(record); err != nil {
		t.Fatal(err)
	}
	status, err := publicationStatus(app, site)
	if err != nil || status["state"] != "unknown" {
		t.Fatalf("expired status: %v %v", status, err)
	}
	if _, err := startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision); err != nil {
		t.Fatal("expired attempt blocked retry:", err)
	}
}

func TestPublicationExcludesSymbolArtifactsFromPushBaseline(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, _, _ := pushFixture(t, app)
	before := mustPushState(t, app, site.Id)
	symbols, err := app.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(symbols) != 1 {
		t.Fatal(err)
	}
	file, err := filesystem.NewFileFromBytes([]byte("console.log('published')"), "symbol.js")
	if err != nil {
		t.Fatal(err)
	}
	symbols[0].Set("compiled_js", file)
	symbols[0].Set("compiled_js_hash", "compiler-cache")
	if err := app.Save(symbols[0]); err != nil {
		t.Fatal(err)
	}
	if mustPushState(t, app, site.Id) != before {
		t.Fatal("published symbol artifacts invalidated baseline")
	}
}

func TestPublicationLegacyStatusAndProtectedStorage(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, _, _ := pushFixture(t, app)
	handler, token := publicationHTTP(t, app)
	status, err := publicationStatus(app, site)
	if err != nil || status["state"] != "never_published" {
		t.Fatalf("new site: %v %v", status, err)
	}
	compiledHome(t, app, site, "<h1>Legacy build</h1>")
	if err := GenerateSite(app, site); err != nil {
		t.Fatal(err)
	}
	status, err = publicationStatus(app, site)
	if err != nil || status["state"] != "unknown" || status["unpublished_changes"] != nil {
		t.Fatalf("legacy status: %v %v", status, err)
	}
	// Metadata may not be changed through the generic collection API.
	pushHTTP(t, handler, publicationRequest("POST", "/api/collections/site_publications/records", token, `{"site":"`+site.Id+`"}`), 403)
	system, err := app.NewFilesystem()
	if err != nil {
		t.Fatal(err)
	}
	defer system.Close()
	reader, err := system.GetReader("sites/" + site.GetString("host") + "/index.html")
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	bytes, _ := io.ReadAll(reader)
	if !strings.Contains(string(bytes), "Legacy build") {
		t.Fatal(string(bytes))
	}
}

func TestPublicationRetainsPreviousAndCleansRetiredBuilds(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, _, _ := pushFixture(t, app)
	compiledHome(t, app, site, "<h1>Published</h1>")
	prefixes := []string{}
	for i := 0; i < 3; i++ {
		attempt, err := startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision)
		if err != nil {
			t.Fatal(err)
		}
		if err := activatePublication(app, site, attempt.GetString("attempt_id")); err != nil {
			t.Fatal(err)
		}
		record, _ := publicationRecord(app, site.Id)
		prefixes = append(prefixes, record.GetString("prefix"))
	}
	system, err := app.NewFilesystem()
	if err != nil {
		t.Fatal(err)
	}
	defer system.Close()
	for i, prefix := range prefixes {
		exists, err := system.Exists(prefix + "/index.html")
		if err != nil {
			t.Fatal(err)
		}
		if exists != (i > 0) {
			t.Fatalf("build %d exists=%v; retain only active and previous", i, exists)
		}
	}
}
