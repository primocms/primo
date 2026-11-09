package internal

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func TestNormalizeLiveURL(t *testing.T) {
	for raw, want := range map[string]string{
		"":                               "",
		"  https://example.org/ ":        "https://example.org",
		"https://user.github.io/repo///": "https://user.github.io/repo",
		"http://example.org/live":        "http://example.org/live",
	} {
		if got, err := normalizeLiveURL(raw); err != nil || got != want {
			t.Errorf("%q: got %q, %v; want %q", raw, got, err, want)
		}
	}
	for _, raw := range []string{"example.org", "ftp://example.org", "https://", "https://a@example.org", "https://example.org/?q=1", "https://example.org/#top", "javascript:alert(1)"} {
		if _, err := normalizeLiveURL(raw); err == nil {
			t.Errorf("%q accepted", raw)
		}
	}
}

func TestLiveURLSetsSitemapBaseAndNoindex(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, _ := pushFixture(t, app)
	if err := RegisterLiveSiteEndpoints(app); err != nil {
		t.Fatal(err)
	}
	handler, token := publicationHTTP(t, app)
	host := site.GetString("host")

	// Another site on the same instance, without a live URL.
	other := core.NewRecord(site.Collection())
	other.Set("name", "Other")
	other.Set("host", "other.localhost")
	other.Set("group", site.GetString("group"))
	if err := app.Save(other); err != nil {
		t.Fatal(err)
	}
	system, err := app.NewFilesystem()
	if err != nil {
		t.Fatal(err)
	}
	defer system.Close()
	if err := system.Upload([]byte("<h1>Other</h1>"), "sites/other.localhost/index.html"); err != nil {
		t.Fatal(err)
	}

	compiledHome(t, app, site, "<h1>Home</h1>")
	publishTracked(t, app, site)
	get := func(url string) *httptest.ResponseRecorder {
		return pushHTTP(t, handler, httptest.NewRequest("GET", url, nil), 200)
	}
	if body := get("http://" + host + "/sitemap.xml").Body.String(); !strings.Contains(body, "<loc>https://"+host+"/</loc>") {
		t.Fatal(body)
	}
	if got := get("http://" + host + "/").Header().Get("X-Robots-Tag"); got != "" {
		t.Fatalf("noindex without a live URL: %q", got)
	}

	url := "/api/primo/sites/" + site.Id + "/live-site"
	pushHTTP(t, handler, publicationRequest("POST", url, "", `{"live_url":"https://example.org"}`), 401)
	pushHTTP(t, handler, publicationRequest("POST", url, token, `{"live_url":"example.org"}`), 400)
	response := pushHTTP(t, handler, publicationRequest("POST", url, token, `{"live_url":"https://example.org/site/"}`), 200)
	if !strings.Contains(response.Body.String(), `"live_url":"https://example.org/site"`) {
		t.Fatal(response.Body.String())
	}
	if got := pushHTTP(t, handler, publicationRequest("GET", url, token, ""), 200).Body.String(); !strings.Contains(got, "https://example.org/site") {
		t.Fatal(got)
	}

	// Primo's copy is hidden from search engines: host traffic and preview alike.
	for _, page := range []string{"http://" + host + "/", "http://" + host + "/sitemap.xml", "http://dashboard.localhost/?_site=" + site.Id} {
		if got := get(page).Header().Get("X-Robots-Tag"); got != "noindex, nofollow" {
			t.Errorf("%s: X-Robots-Tag %q", page, got)
		}
	}
	if got := get("http://other.localhost/").Header().Get("X-Robots-Tag"); got != "" {
		t.Errorf("other site got X-Robots-Tag %q", got)
	}

	// The next publication bases the sitemap on the live URL.
	entry.Set("value", "Next draft")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	site, err = app.FindRecordById("sites", site.Id)
	if err != nil {
		t.Fatal(err)
	}
	publishTracked(t, app, site)
	body := get("http://" + host + "/sitemap.xml").Body.String()
	if !strings.Contains(body, "<loc>https://example.org/site/</loc>") || strings.Contains(body, host) {
		t.Fatal(body)
	}

	// Clearing the live URL lifts noindex.
	pushHTTP(t, handler, publicationRequest("POST", url, token, `{"live_url":""}`), 200)
	if got := get("http://" + host + "/").Header().Get("X-Robots-Tag"); got != "" {
		t.Fatalf("noindex after clearing: %q", got)
	}
}
