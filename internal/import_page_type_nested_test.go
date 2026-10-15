package internal

import (
	"reflect"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

func TestPageTypeNestedFieldsRoundTrip(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["page-types/default/fields.yaml"] = `
- name: title
  type: text
- name: cards
  type: repeater
  subfields:
    - name: title
      type: text
    - name: details
      type: group
      subfields:
        - name: title
          type: text
- name: sidebar
  type: group
  subfields:
    - name: title
      type: text
`
	var ids map[string]string
	for pass := 0; pass < 3; pass++ {
		result, err := processImport(app, site, zipFiles(t, files), false)
		if err != nil {
			t.Fatal(err)
		}
		fields, err := app.FindRecordsByFilter("page_type_fields", "page_type.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
		if err != nil {
			t.Fatal(err)
		}
		byID := map[string]*core.Record{}
		for _, field := range fields {
			byID[field.Id] = field
		}
		got := map[string]string{}
		for _, field := range fields {
			got[buildBlockFieldCompositeKey(field, byID)] = field.Id
		}
		for _, key := range []string{"title", "cards", "cards/title", "cards/details", "cards/details/title", "sidebar", "sidebar/title"} {
			if got[key] == "" {
				t.Fatalf("pass %d: missing %s: %+v", pass, key, got)
			}
		}
		if len(got) != 7 {
			t.Fatalf("pass %d: wrong field count: %+v", pass, got)
		}
		for _, warning := range result.Warnings {
			if warning.Kind == "unsupported_subfields" {
				t.Fatalf("nested fields rejected: %+v", warning)
			}
		}
		if pass > 0 && !reflect.DeepEqual(ids, got) {
			t.Fatalf("field IDs changed: %+v -> %+v", ids, got)
		}
		ids = got
		archive, err := exportSiteToZip(app, site)
		if err != nil {
			t.Fatal(err)
		}
		files["page-types/default/fields.yaml"] = readZipFile(t, archive, "page-types/default/fields.yaml")
		var exported []map[string]any
		if err := yaml.Unmarshal([]byte(files["page-types/default/fields.yaml"]), &exported); err != nil {
			t.Fatal(err)
		}
		if len(exported) != 3 {
			t.Fatalf("export lost nesting: %s", files["page-types/default/fields.yaml"])
		}
	}
	// Removing one nested branch must preserve the unrelated title fields.
	files["page-types/default/fields.yaml"] = "- name: title\n  type: text\n- name: sidebar\n  type: group\n- name: title\n  type: text\n  parent: sidebar\n"
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"title", "sidebar", "sidebar/title"} {
		if _, err := app.FindRecordById("page_type_fields", ids[key]); err != nil {
			t.Fatalf("removed unrelated field %s: %v", key, err)
		}
	}
	if _, err := app.FindRecordById("page_type_fields", ids["cards"]); err == nil {
		t.Fatal("removed branch survived")
	}
}

func TestPageTypeNestedContentRoundTrip(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["page-types/default/fields.yaml"] = "- name: title\n  type: text\n- name: cards\n  type: repeater\n  subfields:\n    - name: title\n      type: text\n    - name: details\n      type: group\n      subfields:\n        - name: title\n          type: text\n"
	content := map[string]any{"title": "Root title", "cards": []any{map[string]any{"title": "Card one", "details": map[string]any{"title": "Deep one"}}, map[string]any{"title": "Card two", "details": map[string]any{"title": "Deep two"}}}}
	files["pages/index.yaml"] = scopeYAML(t, map[string]any{"name": "Home", "page_type": "Default", "fields": content, "sections": []any{}})
	for pass := 0; pass < 3; pass++ {
		if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
			t.Fatal(err)
		}
		entries, err := app.FindRecordsByFilter("page_entries", "page.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
		if err != nil {
			t.Fatal(err)
		}
		// Repeater items and nested groups must be entries, as in the editor,
		// rather than one opaque JSON value that useContent cannot resolve.
		if len(entries) != 9 {
			t.Fatalf("pass %d: expected 9 structured entries, got %d", pass, len(entries))
		}
		if pass == 1 {
			for _, entry := range entries {
				if normalizeValue(entry.Get("value")) == "Deep one" {
					entry.Set("value", "Client edit")
					if err := app.Save(entry); err != nil {
						t.Fatal(err)
					}
				}
			}
			content["cards"].([]any)[0].(map[string]any)["details"].(map[string]any)["title"] = "Client edit"
		}
		archive, err := exportSiteToZip(app, site)
		if err != nil {
			t.Fatal(err)
		}
		raw := readZipFile(t, archive, "pages/index.yaml")
		var page map[string]any
		if err := yaml.Unmarshal([]byte(raw), &page); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(page["fields"], content) {
			t.Fatalf("pass %d: nested content changed: %s", pass, raw)
		}
		files["pages/index.yaml"] = raw
		files["page-types/default/fields.yaml"] = readZipFile(t, archive, "page-types/default/fields.yaml")
	}
	// Simulate the previous importer: one JSON value for the whole repeater.
	entries, err := app.FindRecordsByFilter("page_entries", "page.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatal(err)
	}
	pageID := entries[0].GetString("page")
	for _, entry := range entries {
		if entry.GetString("parent") == "" {
			if err := app.Delete(entry); err != nil {
				t.Fatal(err)
			}
		}
	}
	fields, err := app.FindRecordsByFilter("page_type_fields", "page_type.site = {:site} && parent = ''", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatal(err)
	}
	collection, err := app.FindCollectionByNameOrId("page_entries")
	if err != nil {
		t.Fatal(err)
	}
	for _, field := range fields {
		entry := core.NewRecord(collection)
		entry.Set("page", pageID)
		entry.Set("field", field.Id)
		entry.Set("locale", "en")
		entry.Set("value", content[field.GetString("key")])
		if err := app.Save(entry); err != nil {
			t.Fatal(err)
		}
	}
	archive, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	raw := readZipFile(t, archive, "pages/index.yaml")
	var page map[string]any
	if err := yaml.Unmarshal([]byte(raw), &page); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(page["fields"], content) {
		t.Fatalf("legacy JSON content lost: %s", raw)
	}
	files["pages/index.yaml"] = raw
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	entries, err = app.FindRecordsByFilter("page_entries", "page.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(entries) != 9 {
		t.Fatalf("legacy JSON did not become structured entries: %d, %v", len(entries), err)
	}

}
