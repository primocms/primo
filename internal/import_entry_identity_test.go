package internal

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestReimportUnchangedExportPreservesSectionEntries(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	productionValidation(t, app)
	site, entry, archive := pushFixture(t, app)
	// A dashboard-created page has no remembered source file. A pull followed
	// by a code-only push must not recreate its unchanged content tree.
	page, err := app.FindFirstRecordByFilter("pages", "site = {:site}", map[string]any{"site": site.Id})
	if err != nil {
		t.Fatal(err)
	}
	page.Set("raw_source", "")
	if err := app.Save(page); err != nil {
		t.Fatal(err)
	}
	before, err := json.Marshal(entry)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := processImport(app, site, archive, false); err != nil {
		t.Fatal(err)
	}
	after, err := app.FindRecordById("page_section_entries", entry.Id)
	if err != nil {
		t.Fatalf("unchanged entry replaced: %v", err)
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(afterJSON) {
		t.Fatalf("unchanged entry modified: %s -> %s", before, afterJSON)
	}
}

func TestUnchangedNestedEntriesRetainIdentityAndChangedValuesStillImport(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	productionValidation(t, app)
	site := createImportTestSite(t, app)
	files := map[string]string{
		"blocks/hero/config.yaml":        "name: Hero\n",
		"blocks/hero/component.svelte":   "<h1>Nested</h1>",
		"blocks/hero/fields.yaml":        collisionFieldsYAML(),
		"page-types/default/config.yaml": "name: Default\nallowed_blocks: [hero]\n",
		"pages/index.yaml":               scopeYAML(t, map[string]any{"name": "Home", "page_type": "Default", "sections": []any{map[string]any{"block": "hero", "content": collisionContent("nested")}}}),
	}
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	entries, err := app.FindRecordsByFilter("page_section_entries", "section.page.site = {:site}", "id", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatal(err)
	}
	before, err := json.Marshal(entries)
	if err != nil {
		t.Fatal(err)
	}
	archive, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := processImport(app, site, archive, false); err != nil {
		t.Fatal(err)
	}
	after, err := app.FindRecordsByFilter("page_section_entries", "section.page.site = {:site}", "id", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatal(err)
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(afterJSON) {
		t.Fatal("unchanged nested content identities or parent bindings changed")
	}
	// Change a value in the same exported page while retaining its section ID.
	pageYAML := readZipFile(t, archive, "pages/index.yaml")
	changed := strings.Replace(pageYAML, "nested root", "changed root", 1)
	if changed == pageYAML {
		t.Fatal("fixture did not change")
	}
	if _, err := processImport(app, site, zipFiles(t, map[string]string{"pages/index.yaml": changed}), false); err != nil {
		t.Fatal(err)
	}
	exported, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(readZipFile(t, exported, "pages/index.yaml"), "changed root") {
		t.Fatal("changed content was incorrectly skipped")
	}
}
