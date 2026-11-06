package internal

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func productionValidation(t *testing.T, app *pocketbase.PocketBase) {
	t.Helper()
	old := DevMode
	DevMode = false
	t.Cleanup(func() { DevMode = old })
	if err := RegisterValidation(app); err != nil {
		t.Fatal(err)
	}
}

func TestProductionPageCreatedTimestampValidation(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	productionValidation(t, app)
	site := createImportTestSite(t, app)
	collection, err := app.FindCollectionByNameOrId("page_types")
	if err != nil {
		t.Fatal(err)
	}
	pageType := core.NewRecord(collection)
	pageType.Set("site", site.Id)
	pageType.Set("name", "Default")
	if err := app.Save(pageType); err != nil {
		t.Fatal(err)
	}
	collection, err = app.FindCollectionByNameOrId("pages")
	if err != nil {
		t.Fatal(err)
	}
	page := core.NewRecord(collection)
	for key, value := range map[string]any{"site": site.Id, "page_type": pageType.Id, "name": "Home", "slug": "", "parent": "", "index": 0} {
		page.Set(key, value)
	}
	if err := app.Save(page); err != nil {
		t.Fatalf("production create: %v", err)
	}
	created := page.GetDateTime("created")
	page.Set("name", "Renamed")
	if err := app.Save(page); err != nil {
		t.Fatalf("production update: %v", err)
	}
	if page.GetDateTime("created") != created {
		t.Fatal("update changed creation timestamp")
	}
	page.Set("name", "")
	if err := app.Save(page); err == nil {
		t.Fatal("empty required name bypassed validation")
	}
	stored, err := app.FindRecordById("pages", page.Id)
	if err != nil || stored.GetString("name") != "Renamed" {
		t.Fatal("invalid update changed stored content", err)
	}
}

func TestProductionImportAndPublicationValidation(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	productionValidation(t, app)
	// pushFixture imports a new site through the real import implementation.
	site, _, archive := pushFixture(t, app)
	handler, token := publicationHTTP(t, app)
	before := mustPushState(t, app, site.Id)
	// A second guarded import must validate existing records as well.
	pushHTTP(t, handler, pushRequest(t, "/api/primo/import/"+site.Id, token, before.Revision, false, archive), 200)
	stored, err := app.FindRecordsByFilter("page_section_entries", "section.page.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(stored) != 1 {
		t.Fatal("import lost authoritative content", err)
	}
	var headline string
	if err := stored[0].UnmarshalJSONField("value", &headline); err != nil || headline != "Original headline" {
		t.Fatalf("import content = %q: %v", headline, err)
	}
	for _, html := range []string{"<h1>First production publication</h1>", "<h1>Second production publication</h1>"} {
		revision := mustPushState(t, app, site.Id).Revision
		attempt, err := startPublication(app, site.Id, revision)
		if err != nil {
			t.Fatal(err)
		}
		compiledHome(t, app, site, html)
		url := "/api/primo/publication/" + site.Id + "/" + attempt.GetString("attempt_id") + "/activate"
		pushHTTP(t, handler, publicationRequest("POST", url, token, "{}"), 200)
		if body := publishedBody(t, handler, site.GetString("host")); !strings.Contains(body, html) {
			t.Fatal("publication missing compiled output", body)
		}
	}
}
