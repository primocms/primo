package internal

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func newPushTestApp(t *testing.T) *pocketbase.PocketBase {
	t.Helper()
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatal(err)
	}
	return app
}

func pushTestHTTP(t *testing.T, app *pocketbase.PocketBase) (http.Handler, string) {
	t.Helper()
	for _, register := range []func(*pocketbase.PocketBase) error{RegisterPushGuardEndpoints, RegisterImportEndpoint, RegisterExportEndpoint, RegisterLibraryImportEndpoint, RegisterLibraryExportEndpoint, RegisterBootstrapEndpoint} {
		if err := register(app); err != nil {
			t.Fatal(err)
		}
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.OnServe().Trigger(&core.ServeEvent{App: app, Router: router}); err != nil {
		t.Fatal(err)
	}
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	user := core.NewRecord(users)
	user.Set("email", "push-test@example.com")
	user.Set("name", "Push Test")
	user.Set("serverRole", "developer")
	user.SetPassword("push-test-password")
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	return mux, token
}

func pushFixture(t *testing.T, app *pocketbase.PocketBase) (*core.Record, *core.Record, []byte) {
	t.Helper()
	site := createImportTestSite(t, app)
	files := map[string]string{
		"blocks/hero/config.yaml":        "name: Hero\n",
		"blocks/hero/component.svelte":   "<h1>{heading}</h1><style>h1 { color: red; }</style>",
		"blocks/hero/fields.yaml":        "- name: heading\n  type: text\n",
		"page-types/default/config.yaml": "name: Default\nallowed_blocks: [hero]\n",
		"pages/index.yaml":               "name: Home\npage_type: Default\nsections:\n  - block: hero\n    content:\n      heading: Original headline\n",
	}
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	entries, err := app.FindRecordsByFilter("page_section_entries", "section.page.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(entries) != 1 {
		t.Fatalf("entries: %v, %v", entries, err)
	}
	exported, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	return site, entries[0], exported
}

func pushRequest(t *testing.T, endpoint, token, revision string, force bool, data []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	file, err := w.CreateFormFile("file", "site.zip")
	if err != nil {
		t.Fatal(err)
	}
	file.Write(data)
	if revision != "" {
		w.WriteField("expected_revision", revision)
	}
	if force {
		w.WriteField("force", "true")
	}
	w.Close()
	req := httptest.NewRequest("POST", endpoint, &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	return req
}

func pushHTTP(t *testing.T, handler http.Handler, request *http.Request, expected int) *httptest.ResponseRecorder {
	t.Helper()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != expected {
		t.Fatalf("got HTTP %d, want %d: %s", response.Code, expected, response.Body.String())
	}
	return response
}

func mustPushState(t *testing.T, app core.App, target string) pushState {
	t.Helper()
	state, err := readPushState(app, target)
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func TestPushGuardRejectsStaleAndMissingBaselinesAndPreservesContent(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, archive := pushFixture(t, app)
	handler, token := pushTestHTTP(t, app)
	before := mustPushState(t, app, site.Id)
	entry.Set("value", "Client's latest headline")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	current := mustPushState(t, app, site.Id)
	if before.Revision == current.Revision {
		t.Fatal("child edit did not change revision")
	}
	endpoint := "/api/primo/import/" + site.Id
	pushHTTP(t, handler, pushRequest(t, endpoint, token, before.Revision, false, archive), 409)
	pushHTTP(t, handler, pushRequest(t, endpoint, token, "", false, archive), 428)
	// --force is a lease on the version confirmed, not permission to erase
	// an additional edit that arrived during upload/confirmation.
	pushHTTP(t, handler, pushRequest(t, endpoint, token, before.Revision, true, archive), 409)
	if got := mustPushState(t, app, site.Id); got != current {
		t.Fatal("rejected import changed server state")
	}
	got, err := app.FindRecordById("page_section_entries", entry.Id)
	var value string
	if err == nil {
		err = json.Unmarshal([]byte(got.GetString("value")), &value)
	}
	if err != nil || value != "Client's latest headline" {
		t.Fatalf("client edit lost: %v", err)
	}
}

func TestPushGuardForceBacksUpAndReturnsExactRevision(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, archive := pushFixture(t, app)
	handler, token := pushTestHTTP(t, app)
	entry.Set("value", "Client's latest headline")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	current := mustPushState(t, app, site.Id)
	response := pushHTTP(t, handler, pushRequest(t, "/api/primo/import/"+site.Id, token, current.Revision, true, archive), 200)
	var result struct{ Revision, Backup string }
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Revision != mustPushState(t, app, site.Id).Revision {
		t.Fatal("wrong committed revision")
	}
	if result.Backup == "" {
		t.Fatal("missing backup")
	}
	url := "/api/primo/push-backups/" + site.Id + "/" + result.Backup
	req := httptest.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", token)
	backup := pushHTTP(t, handler, req, 200).Body.Bytes()
	if !strings.Contains(readZipFile(t, backup, "pages/index.yaml"), "Client's latest headline") {
		t.Fatal("backup does not contain overwritten content")
	}
	var metadata struct {
		Revision string
		Records  map[string][]map[string]any
	}
	if err := json.Unmarshal([]byte(readZipFile(t, backup, ".primo/backup-records.json")), &metadata); err != nil {
		t.Fatal(err)
	}
	if metadata.Revision != current.Revision || len(metadata.Records["page_section_entries"]) != 1 || metadata.Records["page_section_entries"][0]["value"] != "Client's latest headline" {
		t.Fatal("backup did not preserve original records")
	}
	pushHTTP(t, handler, httptest.NewRequest("GET", url, nil), 401)
	// Restore the backup through the same import protocol and verify its content.
	pushHTTP(t, handler, pushRequest(t, "/api/primo/import/"+site.Id, token, result.Revision, false, backup), 200)
	restored, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(readZipFile(t, restored, "pages/index.yaml"), "Client's latest headline") {
		t.Fatal("backup was not restorable")
	}
}

type editDuringUpload struct {
	io.ReadCloser
	edit func()
	done bool
}

func (r *editDuringUpload) Read(p []byte) (int, error) {
	if !r.done {
		r.done = true
		r.edit()
	}
	return r.ReadCloser.Read(p)
}

func TestPushGuardRechecksAfterUploadAndRollsBackFailedImports(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, archive := pushFixture(t, app)
	handler, token := pushTestHTTP(t, app)
	before := mustPushState(t, app, site.Id)
	endpoint := "/api/primo/import/" + site.Id
	req := pushRequest(t, endpoint, token, before.Revision, false, archive)
	req.Body = &editDuringUpload{ReadCloser: req.Body, edit: func() {
		entry.Set("value", "Edited while upload arrived")
		if err := app.Save(entry); err != nil {
			t.Fatal(err)
		}
	}}
	pushHTTP(t, handler, req, 409)
	current := mustPushState(t, app, site.Id)
	broken := zipFiles(t, map[string]string{"site.yaml": "name: Must not persist\n", "site/fields.yaml": "[invalid yaml"})
	pushHTTP(t, handler, pushRequest(t, endpoint, token, current.Revision, false, broken), 500)
	if mustPushState(t, app, site.Id) != current {
		t.Fatal("failed import persisted metadata or partial writes")
	}
	// Backup failure must prevent every overwrite, including metadata.
	if err := os.WriteFile(filepath.Join(app.DataDir(), "push_backups"), []byte("not a directory"), 0600); err != nil {
		t.Fatal(err)
	}
	pushHTTP(t, handler, pushRequest(t, endpoint, token, current.Revision, true, archive), 500)
	if mustPushState(t, app, site.Id) != current {
		t.Fatal("backup failure still applied overwrite")
	}
}

func TestPushGuardFingerprintScopeAndExportBaseline(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, _ := pushFixture(t, app)
	handler, token := pushTestHTTP(t, app)
	before := mustPushState(t, app, site.Id)
	req := httptest.NewRequest("GET", "/api/primo/export/"+site.Id, nil)
	req.Header.Set("Authorization", token)
	response := pushHTTP(t, handler, req, 200)
	if response.Header().Get(pushRevisionHeader) != before.Revision {
		t.Fatal("export missing baseline")
	}
	// Merely saving identical data or publishing must not cause conflicts.
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	if mustPushState(t, app, site.Id) != before {
		t.Fatal("timestamp-only change invalidated baseline")
	}
	pages, _ := app.FindRecordsByFilter("pages", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	file, err := filesystem.NewFileFromBytes([]byte("<h1>published</h1>"), "generated.html")
	if err != nil {
		t.Fatal(err)
	}
	pages[0].Set("compiled_html", file)
	if err := app.Save(pages[0]); err != nil {
		t.Fatal(err)
	}
	if mustPushState(t, app, site.Id) != before {
		t.Fatal("compiled output invalidated baseline")
	}
	entry.Set("index", 2)
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	if mustPushState(t, app, site.Id) == before {
		t.Fatal("reorder was not detected")
	}
	afterReorder := mustPushState(t, app, site.Id)
	if err := app.Delete(entry); err != nil {
		t.Fatal(err)
	}
	if mustPushState(t, app, site.Id) == afterReorder {
		t.Fatal("deletion was not detected")
	}
}

func TestPushGuardLibraryAndFreshBootstrap(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	handler, token := pushTestHTTP(t, app)
	library := zipFiles(t, map[string]string{
		"library/groups.yaml":                  "- name: Shared\n  folder: shared\n",
		"library/shared/hero/config.yaml":      "name: Hero\n",
		"library/shared/hero/component.svelte": "<h1>Library original</h1>",
	})
	state := mustPushState(t, app, "library")
	pushHTTP(t, handler, pushRequest(t, "/api/primo/import-library", token, state.Revision, false, library), 200)
	baseline := mustPushState(t, app, "library")
	symbols, err := app.FindAllRecords("library_symbols")
	if err != nil || len(symbols) != 1 {
		t.Fatalf("library seed: %v %v", symbols, err)
	}
	symbols[0].Set("name", "Client renamed block")
	if err := app.Save(symbols[0]); err != nil {
		t.Fatal(err)
	}
	pushHTTP(t, handler, pushRequest(t, "/api/primo/import-library", token, baseline.Revision, false, library), 409)
	pushHTTP(t, handler, pushRequest(t, "/api/primo/import-library", token, "", false, library), 428)
	current := mustPushState(t, app, "library")
	response := pushHTTP(t, handler, pushRequest(t, "/api/primo/import-library", token, current.Revision, true, library), 200)
	var result struct{ Backup, Revision string }
	json.Unmarshal(response.Body.Bytes(), &result)
	if result.Backup == "" || result.Revision != mustPushState(t, app, "library").Revision {
		t.Fatal("library overwrite missing backup or revision")
	}
	// Initial bootstrap also returns the revision from the transaction that
	// created the site, so a subsequent authenticated push has a baseline.
	response = pushHTTP(t, handler, pushRequest(t, "/api/primo/bootstrap", "", "", false, zipFiles(t, map[string]string{"site/head.html": "<meta name=example>"})), 200)
	var initial struct {
		SiteID   string `json:"site_id"`
		Revision string
	}
	json.Unmarshal(response.Body.Bytes(), &initial)
	if initial.Revision != mustPushState(t, app, initial.SiteID).Revision {
		t.Fatal("bootstrap missing committed baseline")
	}
}
