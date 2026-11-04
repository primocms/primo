package internal

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func TestReviewMovedPageRetainsOmittedDescendantRoutes(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	if _, err := processImport(app, site, zipFiles(t, baseSiteFiles()), false); err != nil {
		t.Fatal(err)
	}
	pages, err := app.FindAllRecords("pages")
	if err != nil {
		t.Fatal(err)
	}
	home := pages[0]
	create := func(name, slug, parent string) *core.Record {
		return permissionRecord(t, app, "pages", map[string]any{"site": site.Id, "page_type": home.GetString("page_type"), "name": name, "slug": slug, "parent": parent, "index": 1})
	}
	docs := create("Docs", "docs", home.Id)
	faq := create("FAQ", "faq", docs.Id)
	files := map[string]string{"pages/guides.yaml": fmt.Sprintf("_id: %s\nname: Guides\npage_type: default\n", docs.Id), "pages/guides/faq/details.yaml": "name: Details\npage_type: default\n"}
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	paths, err := buildPagePathMap(app, site.Id)
	if err != nil {
		t.Fatal(err)
	}
	if paths["guides/faq"] != faq.Id || paths["guides/faq/details"] == "" || paths["docs/faq"] != "" {
		t.Fatal("descendant route identities lost", paths)
	}
}

func TestReviewSitemapMoveKeepsPathsAndUsesNewHTTPSHost(t *testing.T) {
	data, err := rewriteSitemapHost([]byte(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://old.test/a%20b/?x=1&amp;y=2</loc></url></urlset>`), "new.test")
	if err != nil {
		t.Fatal(err)
	}
	var document sitemap
	if err := xml.Unmarshal(data, &document); err != nil {
		t.Fatal(err)
	}
	if len(document.URLs) != 1 || document.URLs[0].Loc != "https://new.test/a%20b/?x=1&y=2" {
		t.Fatal(string(data))
	}
}

func TestReviewPageParentsRejectCyclesForDeveloperAndInternalSaves(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterContentPermissions(app); err != nil {
		t.Fatal(err)
	}
	site := createImportTestSite(t, app)
	if _, err := processImport(app, site, zipFiles(t, baseSiteFiles()), false); err != nil {
		t.Fatal(err)
	}
	pages, _ := app.FindAllRecords("pages")
	home := pages[0]
	child := permissionRecord(t, app, "pages", map[string]any{"site": site.Id, "page_type": home.GetString("page_type"), "name": "Child", "slug": "child", "parent": home.Id})
	home.Set("parent", child.Id)
	if err := app.Save(home); err == nil {
		t.Fatal("page ancestor cycle accepted")
	}
}

func TestReviewInvitedUserCanUpdateProfileWithoutEscalating(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterContentPermissions(app); err != nil {
		t.Fatal(err)
	}
	user := permissionRecord(t, app, "users", map[string]any{"email": "invited@example.test", "name": "Before"})
	handler, _ := pushTestHTTP(t, app)
	token := permissionToken(t, user)
	for _, tc := range []struct {
		body   string
		status int
	}{{`{"name":"After"}`, 200}, {`{"serverRole":"developer"}`, 403}, {`{"email":"other@example.test"}`, 403}} {
		req := httptest.NewRequest("PATCH", "/api/collections/users/records/"+user.Id, strings.NewReader(tc.body))
		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")
		pushHTTP(t, handler, req, tc.status)
	}
	saved, _ := app.FindRecordById("users", user.Id)
	if saved.GetString("name") != "After" || saved.GetString("serverRole") != "" {
		t.Fatal("profile/role boundary lost")
	}
}

type reviewBlockingBody struct {
	started, release chan struct{}
	once             sync.Once
}

func (b *reviewBlockingBody) Read([]byte) (int, error) {
	b.once.Do(func() { close(b.started) })
	<-b.release
	return 0, io.EOF
}
func (b *reviewBlockingBody) Close() error { return nil }
func TestReviewConcurrentImportsRejectBeforeReadingBodies(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	handler, token := pushTestHTTP(t, app)
	slow := &reviewBlockingBody{started: make(chan struct{}), release: make(chan struct{})}
	req := httptest.NewRequest("POST", "/api/primo/bootstrap", slow)
	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=test")
	done := make(chan struct{})
	go func() { defer close(done); handler.ServeHTTP(httptest.NewRecorder(), req) }()
	<-slow.started
	defer func() { close(slow.release); <-done }()
	for _, endpoint := range []string{"/api/primo/bootstrap", "/api/primo/import-library", "/api/primo/import/unknownsite0001"} {
		body := &snapshotReadCounter{ReadCloser: io.NopCloser(bytes.NewReader(nil))}
		blocked := httptest.NewRequest("POST", endpoint, body)
		blocked.Header.Set("Authorization", token)
		blocked.Header.Set("Content-Type", "multipart/form-data; boundary=test")
		response := pushHTTP(t, handler, blocked, http.StatusTooManyRequests)
		if body.reads != 0 || response.Header().Get("Retry-After") == "" {
			t.Fatal("busy import read or failed to explain retry", body.reads)
		}
	}
}

func TestReviewNestedPageReferencesAndEmptyRepeatersRoundTrip(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["page-types/default/fields.yaml"] = "- name: title\n  type: text\n- name: details\n  type: group\n  subfields:\n    - name: title\n      type: text\n- name: cards\n  type: repeater\n  subfields:\n    - name: title\n      type: text\n"
	files["blocks/hero/fields.yaml"] = "- name: heading\n  type: text\n- name: nested\n  type: page-field\n  config: {field: default--details/title}\n"
	files["pages/index.yaml"] = "name: Home\npage_type: default\ncontent:\n  details: {title: Nested}\n  cards: []\n"
	result, err := processImport(app, site, zipFiles(t, files), false)
	if err != nil {
		t.Fatal(err)
	}
	for _, warning := range result.Warnings {
		if strings.Contains(warning.Kind, "orphaned") {
			t.Fatal(warning)
		}
	}
	archive, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	page := readZipFile(t, archive, "pages/index.yaml")
	if !strings.Contains(page, "cards: []") {
		t.Fatal("explicit empty repeater lost", page)
	}
	before, err := app.FindRecordsByFilter("page_entries", "page.site = {:site}", "id", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatal(err)
	}
	beforeJSON, _ := json.Marshal(before)
	renamed := strings.Replace(page, "name: Home", "name: Renamed", 1)
	if renamed == page {
		t.Fatal("fixture rename did not change source")
	}
	if _, err := processImport(app, site, zipFiles(t, map[string]string{"pages/index.yaml": renamed}), false); err != nil {
		t.Fatal(err)
	}
	after, err := app.FindRecordsByFilter("page_entries", "page.site = {:site}", "id", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatal(err)
	}
	afterJSON, _ := json.Marshal(after)
	if string(beforeJSON) != string(afterJSON) {
		t.Fatal("page metadata edit replaced unchanged nested entry identities")
	}
	block := readZipFile(t, archive, "blocks/hero/fields.yaml")
	if !strings.Contains(block, "default--details/title") {
		t.Fatal("nested reference changed identity", block)
	}
	// The archive must round-trip its qualified reference without a false orphan.
	_, err = processImport(app, site, archive, false)
	if err != nil {
		t.Fatal(err)
	}
}

func TestReviewStagedFinalAuthorizationUsesActualRequest(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	if err := RegisterContentPermissions(app); err != nil {
		t.Fatal(err)
	}
	user := permissionRecord(t, app, "users", map[string]any{"email": "staging@example.test", "serverRole": "developer"})
	collection, err := app.FindCollectionByNameOrId("sites")
	if err != nil {
		t.Fatal(err)
	}
	rule := "@request.body.expected_revision != '' && @request.query.allow = 'yes' && @request.headers.x_review = 'yes'"
	collection.UpdateRule = &rule
	if err := app.Save(collection); err != nil {
		t.Fatal(err)
	}
	handler, _ := pushTestHTTP(t, app)
	token := permissionToken(t, user)
	data := zipFiles(t, map[string]string{"site.yaml": "name: Updated\n"})
	endpoint := "/api/primo/import/" + site.Id
	id := chunkStart(t, handler, token, endpoint, data)
	chunkPut(t, handler, token, id, 0, data, 200)
	var form bytes.Buffer
	writer := multipart.NewWriter(&form)
	writer.WriteField("upload_id", id)
	writer.WriteField("expected_revision", mustPushState(t, app, site.Id).Revision)
	writer.Close()
	req := httptest.NewRequest("POST", endpoint+"?allow=yes", &form)
	req.Header.Set("X-Review", "yes")
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", token)
	response := pushHTTP(t, handler, req, 200)
	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
}

func TestReviewConcurrentSnapshotsRejectBeforeReadingBody(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterRecoverySnapshotUploads(app); err != nil {
		t.Fatal(err)
	}
	handler, token := pushTestHTTP(t, app)
	slow := &reviewBlockingBody{started: make(chan struct{}), release: make(chan struct{})}
	endpoint := "/api/collections/site_snapshots/records"
	req := httptest.NewRequest("POST", endpoint, slow)
	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=test")
	done := make(chan struct{})
	go func() { defer close(done); handler.ServeHTTP(httptest.NewRecorder(), req) }()
	<-slow.started
	defer func() { close(slow.release); <-done }()
	body := &snapshotReadCounter{ReadCloser: io.NopCloser(bytes.NewReader(nil))}
	req = httptest.NewRequest("POST", endpoint, body)
	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=test")
	pushHTTP(t, handler, req, http.StatusTooManyRequests)
	if body.reads != 0 {
		t.Fatal("concurrent snapshot body was parsed")
	}
}
