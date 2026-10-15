package internal

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestPublishedResponseHeaders(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	system, err := app.NewFilesystem()
	if err != nil {
		t.Fatal(err)
	}
	defer system.Close()
	for _, file := range []string{"index.html", "about/index.html", "_symbols/hero.js"} {
		if err := system.Upload([]byte("published"), "sites/"+site.GetString("host")+"/"+file); err != nil {
			t.Fatal(err)
		}
	}
	if err := ServeSites(app); err != nil {
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
	for _, route := range []string{"/", "/about", "/_symbols/hero.js?v=first"} {
		url := "http://" + site.GetString("host") + route
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, url, nil))
		if response.Code != 200 {
			t.Fatalf("%s: %d", route, response.Code)
		}
		for header, want := range map[string]string{
			"Cache-Control":          "no-cache",
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy":        "strict-origin-when-cross-origin",
		} {
			if got := response.Header().Get(header); got != want {
				t.Errorf("%s: %s = %q, want %q", route, header, got, want)
			}
		}
		// Revalidation must retain cache policy on a 304 response too.
		req := httptest.NewRequest(http.MethodGet, url, nil)
		req.Header.Set("If-Modified-Since", response.Header().Get("Last-Modified"))
		conditional := httptest.NewRecorder()
		handler.ServeHTTP(conditional, req)
		if conditional.Code != 304 || conditional.Header().Get("Cache-Control") != "no-cache" {
			t.Errorf("conditional %s: status %d, headers %v", route, conditional.Code, conditional.Header())
		}
	}
	for _, preview := range []bool{false, true} {
		req := httptest.NewRequest(http.MethodGet, "http://dashboard.localhost/_symbols/hero.js", nil)
		if preview {
			req.Header.Set("Referer", "http://dashboard.localhost/?_site="+site.Id)
		} else {
			req = httptest.NewRequest(http.MethodGet, "http://dashboard.localhost/?_site="+site.Id, nil)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" {
			t.Errorf("preview: %d %v", response.Code, response.Header())
		}
		if response.Header().Get("Content-Security-Policy") != "frame-ancestors *" {
			t.Error("preview framing changed")
		}
	}
}
