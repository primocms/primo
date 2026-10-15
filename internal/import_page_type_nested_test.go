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
		for _, warning := range result.Warnings {
			if warning.Kind == "unsupported_subfields" {
				t.Fatalf("nested fields rejected: %+v", warning)
			}
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
