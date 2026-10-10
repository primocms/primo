package internal

import (
	"crypto/sha256"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func TestPublishedSymbolVersionURLs(t *testing.T) {
	for _, tracked := range []bool{false, true} {
		t.Run(fmt.Sprintf("tracked=%v", tracked), func(t *testing.T) {
			app := newPushTestApp(t)
			defer app.ResetBootstrapState()
			site, _, _ := pushFixture(t, app)
			handler, _ := publicationHTTP(t, app)
			symbols, err := app.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
			if err != nil || len(symbols) != 1 {
				t.Fatalf("symbols: %v %v", symbols, err)
			}
			for _, js := range []string{"export const scope = 'old';", "export const scope = 'new';"} {
				file, err := filesystem.NewFileFromBytes([]byte(js), "symbol.js")
				if err != nil {
					t.Fatal(err)
				}
				symbols[0].Set("compiled_js", file)
				if err := app.Save(symbols[0]); err != nil {
					t.Fatal(err)
				}
				scriptURL := fmt.Sprintf("/_symbols/%s.js?v=%x", symbols[0].Id, sha256.Sum256([]byte(js)))
				compiledHome(t, app, site, "<script type=\"module\">import('"+scriptURL+"')</script>")
				if tracked {
					attempt, err := startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision)
					if err != nil {
						t.Fatal(err)
					}
					if err := activatePublication(app, site, attempt.GetString("attempt_id")); err != nil {
						t.Fatal(err)
					}
				} else if err := GenerateSite(app, site); err != nil {
					t.Fatal(err)
				}
				if !strings.Contains(publishedBody(t, handler, site.GetString("host")), scriptURL) {
					t.Fatal("generation lost the versioned import")
				}
				response := pushHTTP(t, handler, httptest.NewRequest("GET", "http://"+site.GetString("host")+scriptURL, nil), 200)
				if response.Body.String() != js {
					t.Fatal("versioned URL did not serve the active compiled script:", response.Body.String())
				}
				// Dashboard subresources use the page referrer for site selection.
				request := httptest.NewRequest("GET", "http://localhost"+scriptURL, nil)
				request.Header.Set("Referer", "http://localhost/?_site="+site.Id)
				preview := pushHTTP(t, handler, request, 200)
				if preview.Body.String() != js || preview.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("preview script routing/cache policy changed")
				}
			}
		})
	}
}
