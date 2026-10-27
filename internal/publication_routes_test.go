package internal

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func TestPublicationRejectsBrokenRoutesWithoutReplacingLiveSite(t *testing.T) {
	for _, broken := range []string{"detached-page", "duplicate-route"} {
		t.Run(broken, func(t *testing.T) {
			app := newPushTestApp(t)
			defer app.ResetBootstrapState()
			site, _, _ := pushFixture(t, app)
			handler, token := publicationHTTP(t, app)
			compiledHome(t, app, site, "<h1>Keep this live homepage</h1>")
			initial, err := startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision)
			if err != nil {
				t.Fatal(err)
			}
			if err := activatePublication(app, site, initial.GetString("attempt_id")); err != nil {
				t.Fatal(err)
			}
			active, err := publicationRecord(app, site.Id)
			if err != nil {
				t.Fatal(err)
			}
			prefix := active.GetString("prefix")
			revision := active.GetString("published_revision")
			home, err := app.FindFirstRecordByFilter("pages", "site = {:site}", map[string]any{"site": site.Id})
			if err != nil {
				t.Fatal(err)
			}
			count := 1
			if broken == "duplicate-route" {
				count = 2
			}
			for i := 0; i < count; i++ {
				page := core.NewRecord(home.Collection())
				page.Set("site", site.Id)
				page.Set("page_type", home.GetString("page_type"))
				page.Set("name", "Uploaded page")
				page.Set("slug", "start")
				if broken == "duplicate-route" {
					page.Set("parent", home.Id)
				}
				file, err := filesystem.NewFileFromBytes([]byte("<h1>Bad replacement</h1>"), "index.html")
				if err != nil {
					t.Fatal(err)
				}
				page.Set("compiled_html", file)
				if err := app.Save(page); err != nil {
					t.Fatal(err)
				}
			}
			attempt, err := startPublication(app, site.Id, mustPushState(t, app, site.Id).Revision)
			if err != nil {
				t.Fatal(err)
			}
			endpoint := "/api/primo/publication/" + site.Id + "/" + attempt.GetString("attempt_id") + "/activate"
			response := pushHTTP(t, handler, publicationRequest("POST", endpoint, token, "{}"), 500)
			if !strings.Contains(response.Body.String(), "cannot publish") {
				t.Fatal(response.Body.String())
			}
			after, err := publicationRecord(app, site.Id)
			if err != nil {
				t.Fatal(err)
			}
			if after.GetString("prefix") != prefix || after.GetString("published_revision") != revision {
				t.Fatal("invalid route tree replaced the active publication")
			}
			if got := publishedBody(t, handler, site.GetString("host")); !strings.Contains(got, "Keep this live homepage") {
				t.Fatal(got)
			}
		})
	}
}
