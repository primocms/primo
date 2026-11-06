package internal

import (
	"archive/zip"
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func archiveFiles(t *testing.T, body []byte) map[string]string {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	files := map[string]string{}
	for _, file := range reader.File {
		content, err := file.Open()
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(content)
		content.Close()
		if err != nil {
			t.Fatal(err)
		}
		files[file.Name] = string(data)
	}
	return files
}

func publishTracked(t *testing.T, app *pocketbase.PocketBase, site *core.Record) activeBuild {
	t.Helper()
	attempt, err := startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision)
	if err != nil {
		t.Fatal(err)
	}
	if err := activatePublication(app, site, attempt.GetString("attempt_id")); err != nil {
		t.Fatal(err)
	}
	build, err := findActiveBuild(app, site)
	if err != nil {
		t.Fatal(err)
	}
	return build
}

func TestPublicationArchiveServesActiveBuild(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, _ := pushFixture(t, app)
	handler, token := publicationHTTP(t, app)
	url := "/api/primo/publication/" + site.Id + "/archive"

	pushHTTP(t, handler, publicationRequest("GET", url, token, ""), 404)

	// Legacy output under sites/{host}/ is served until a tracked build exists.
	compiledHome(t, app, site, "<h1>Legacy build</h1>")
	if err := GenerateSite(app, site); err != nil {
		t.Fatal(err)
	}
	response := pushHTTP(t, handler, publicationRequest("GET", url, token, ""), 200)
	if files := archiveFiles(t, response.Body.Bytes()); files["index.html"] != "<h1>Legacy build</h1>" || files["sitemap.xml"] == "" {
		t.Fatalf("legacy archive: %v", files)
	}
	if response.Header().Get("X-Primo-Revision") != "" {
		t.Fatal("legacy build claimed a revision")
	}

	compiledHome(t, app, site, "<h1>Tracked build</h1>")
	build := publishTracked(t, app, site)
	response = pushHTTP(t, handler, publicationRequest("GET", url, token, ""), 200)
	files := archiveFiles(t, response.Body.Bytes())
	if files["index.html"] != "<h1>Tracked build</h1>" {
		t.Fatalf("tracked archive: %v", files)
	}
	for name := range files {
		if strings.HasPrefix(name, "/") || strings.HasPrefix(name, "published/") || strings.HasPrefix(name, "sites/") {
			t.Fatalf("archive path not relative to the build: %s", name)
		}
	}
	if response.Header().Get("X-Primo-Revision") != build.Revision || build.Revision == "" {
		t.Fatalf("revision header %q, want %q", response.Header().Get("X-Primo-Revision"), build.Revision)
	}
	if response.Header().Get("Content-Type") != "application/zip" || response.Header().Get("Content-Disposition") == "" {
		t.Fatal(response.Header())
	}

	// Without edit rights and without a link: no archive.
	pushHTTP(t, handler, publicationRequest("GET", url, "", ""), 403)

	// A signed link works without a session while its build stays active.
	link, err := newArchiveToken(app, site.Id, build, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	response = pushHTTP(t, handler, publicationRequest("GET", url+"?token="+link, "", ""), 200)
	if archiveFiles(t, response.Body.Bytes())["index.html"] != "<h1>Tracked build</h1>" {
		t.Fatal("signed link served another build")
	}
	expired, err := newArchiveToken(app, site.Id, build, -time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	otherSite, err := newArchiveToken(app, "otherSite000000", build, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	for name, bad := range map[string]string{"expired": expired, "other site": otherSite, "garbage": "not-a-token"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, publicationRequest("GET", url+"?token="+bad, "", ""))
		if response.Code != http.StatusForbidden {
			t.Errorf("%s: got %d", name, response.Code)
		}
	}

	// Publishing a new revision invalidates links to the previous one.
	entry.Set("value", "Next draft")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	compiledHome(t, app, site, "<h1>Next build</h1>")
	publishTracked(t, app, site)
	pushHTTP(t, handler, publicationRequest("GET", url+"?token="+link, "", ""), 403)
}

