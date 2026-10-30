package internal

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDomainAttachPreservesPublication(t *testing.T) {
	for _, mode := range []string{"never-published", "legacy", "tracked"} {
		t.Run(mode, func(t *testing.T) {
			t.Setenv("PRIMO_DOMAIN_PROVIDER", "manual")
			t.Setenv("PRIMO_BASE_DOMAIN", "")
			app := newPushTestApp(t)
			defer app.ResetBootstrapState()
			site, entry, _ := pushFixture(t, app)
			if err := RegisterDomainEndpoints(app); err != nil {
				t.Fatal(err)
			}
			handler, token := publicationHTTP(t, app)
			oldHost := site.GetString("host")
			compiledHome(t, app, site, "<h1>Public content</h1>")
			if mode == "legacy" {
				if err := GenerateSite(app, site); err != nil {
					t.Fatal(err)
				}
			}
			if mode == "tracked" {
				revision := mustPushState(t, app, site.Id).Revision
				attempt, err := startPublication(app, site.Id, revision)
				if err != nil {
					t.Fatal(err)
				}
				pushHTTP(t, handler, publicationRequest("POST", "/api/primo/publication/"+site.Id+"/"+attempt.GetString("attempt_id")+"/activate", token, "{}"), 200)
			}
			before, _ := publicationRecord(app, site.Id)
			oldPrefix, oldRevision := before.GetString("prefix"), before.GetString("published_revision")
			entry.Set("value", "Unpublished draft")
			if err := app.Save(entry); err != nil {
				t.Fatal(err)
			}
			compiledHome(t, app, site, "<h1>Unpublished secret draft</h1>")
			host := "new.example.com"
			pushHTTP(t, handler, publicationRequest("POST", "/api/primo/sites/"+site.Id+"/domain", token, fmt.Sprintf(`{"host":%q}`, host)), 200)
			// Reattaching after a lost response must not republish either.
			pushHTTP(t, handler, publicationRequest("POST", "/api/primo/sites/"+site.Id+"/domain", token, fmt.Sprintf(`{"host":%q}`, host)), 200)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest("GET", "https://"+host+"/", nil))
			if strings.Contains(response.Body.String(), "Unpublished secret draft") {
				t.Fatal("domain attach published draft")
			}
			if mode == "never-published" {
				if response.Code == 200 {
					t.Fatal("unpublished site became public")
				}
			} else {
				if response.Code != 200 || !strings.Contains(response.Body.String(), "Public content") {
					t.Fatal(response.Body.String())
				}
				if response.Header().Get("X-Primo-Site") != site.Id {
					t.Fatal("missing site routing identity")
				}
			}
			after, _ := publicationRecord(app, site.Id)
			if after.GetString("prefix") != oldPrefix || after.GetString("published_revision") != oldRevision {
				t.Fatal("domain attach replaced publication")
			}
			oldResponse := httptest.NewRecorder()
			handler.ServeHTTP(oldResponse, httptest.NewRequest("GET", "http://"+oldHost+"/", nil))
			if strings.Contains(oldResponse.Body.String(), "Public content") {
				t.Fatal("old host still serves site")
			}
		})
	}
}
