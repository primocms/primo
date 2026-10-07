package internal

import (
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

// Every scope deliberately reuses body and cta; details is also reused at
// multiple depths, so matching only an immediate parent's name is insufficient.
func collisionFieldsYAML() string {
	fields := "- name: body\n  type: text\n- name: cta\n  type: link\n" +
		"- name: items\n  type: repeater\n  subfields:\n" +
		"    - name: body\n      type: text\n    - name: cta\n      type: link\n"
	for _, group := range []string{"left", "right"} {
		fields += fmt.Sprintf("- name: %s\n  type: group\n  subfields:\n", group) +
			"    - name: body\n      type: text\n    - name: cta\n      type: link\n" +
			"    - name: details\n      type: group\n      subfields:\n" +
			"        - name: body\n          type: text\n        - name: cta\n          type: link\n"
	}
	return fields
}

func collisionContent(prefix string) map[string]any {
	leaf := func(scope string) map[string]any {
		url := "https://example.com/" + scope
		if scope == "root" || scope == "item-1" {
			url = "/" // Internal page links must also survive root/nested collisions.
		}
		return map[string]any{
			"body": prefix + " " + scope,
			"cta":  map[string]any{"label": prefix + " " + scope + " link", "url": url},
		}
	}
	content := leaf("root")
	content["items"] = []any{leaf("item-0"), leaf("item-1")}
	for _, group := range []string{"left", "right"} {
		value := leaf(group)
		value["details"] = leaf(group + "-details")
		content[group] = value
	}
	return content
}

func scopeYAML(t *testing.T, value any) string {
	t.Helper()
	data, err := yaml.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestImportFieldScopesRoundTrip(t *testing.T) {
	for _, format := range []string{"subfields", "parent"} {
		t.Run(format, func(t *testing.T) {
			fields := collisionFieldsYAML()
			if format == "parent" {
				fields = "- name: body\n  type: text\n- name: cta\n  type: link\n- name: items\n  type: repeater\n"
				for _, group := range []string{"left", "right"} {
					fields += fmt.Sprintf("- name: %s\n  type: group\n- name: details\n  type: group\n  parent: %s\n", group, group)
				}
				for _, parent := range []string{"items", "left", "left/details", "right", "right/details"} {
					fields += fmt.Sprintf("- name: body\n  type: text\n  parent: %s\n- name: cta\n  type: link\n  parent: %s\n", parent, parent)
				}
			}
			testImportFieldScopesRoundTrip(t, fields)
		})
	}
}

func testImportFieldScopesRoundTrip(t *testing.T, fields string) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["blocks/hero/fields.yaml"] = fields + "- name: site_body\n  type: site-field\n  config:\n    field: body\n"
	files["site/fields.yaml"] = fields
	files["blocks/hero/content.yaml"] = scopeYAML(t, collisionContent("default"))
	files["site/content.yaml"] = scopeYAML(t, collisionContent("site"))
	files["pages/index.yaml"] = scopeYAML(t, map[string]any{
		"name": "Home", "page_type": "Default",
		"sections": []any{map[string]any{"block": "hero", "content": collisionContent("page")}},
	})
	delete(files, "pages/vs/index.yaml")
	delete(files, "pages/vs/wordpress.yaml")
	files["page-types/default/layout.yaml"] = scopeYAML(t, map[string]any{
		"header": []any{map[string]any{"block": "hero", "content": collisionContent("layout")}},
		"footer": []any{map[string]any{"block": "hero"}}, // Block-default fallback.
	})

	// Exercise first import, identical-source reimport, a changed page (bypassing
	// raw_source skipping), and two imports of the exported archive.
	archive := zipFiles(t, files)
	var identities map[string]string
	var schemas map[string]string
	for pass := 0; pass < 5; pass++ {
		if pass == 2 {
			var page map[string]any
			if err := yaml.Unmarshal([]byte(files["pages/index.yaml"]), &page); err != nil {
				t.Fatal(err)
			}
			// Mimic CLI writeback of the server-assigned section ID.
			page["sections"].([]any)[0].(map[string]any)["_id"] = identities["page_sections/"]
			files["pages/index.yaml"] = scopeYAML(t, page) + "# force content reimport\n"
			archive = zipFiles(t, files)
		}
		result, err := processImport(app, site, archive, false)
		if err != nil {
			t.Fatalf("pass %d import: %v", pass, err)
		}
		for _, warning := range result.Warnings {
			if pass < 3 && strings.Contains(fields, "parent:") && warning.Kind == "missing_subfields" &&
				(warning.File == "blocks/hero/fields.yaml" || warning.File == "site/fields.yaml") {
				// Legacy flat declarations retain the existing authoring warning.
				continue
			}
			t.Fatalf("pass %d unexpected warning: %+v", pass, warning)
		}
		ids := scopeFieldIdentities(t, app, site)
		ref, err := app.FindRecordById("site_symbol_fields", ids["site_symbol_fields/site_body"])
		if err != nil {
			t.Fatal(err)
		}
		if got := ref.GetString("config"); !strings.Contains(got, ids["site_fields/body"]) {
			t.Fatalf("site-field resolved to a nested body: %s", got)
		}
		if identities == nil {
			identities = ids
		} else if !reflect.DeepEqual(ids, identities) {
			t.Fatalf("pass %d field/owner IDs changed: before=%v after=%v", pass, identities, ids)
		}
		exported, err := exportSiteToZip(app, site)
		if err != nil {
			t.Fatal(err)
		}
		for _, target := range []struct{ file, prefix string }{
			{"blocks/hero/content.yaml", "default"}, {"site/content.yaml", "site"},
			{"pages/index.yaml", "page"}, {"page-types/default/layout.yaml", "layout"},
		} {
			var data map[string]any
			if err := yaml.Unmarshal([]byte(readZipFile(t, exported, target.file)), &data); err != nil {
				t.Fatal(err)
			}
			var got any = data
			switch target.prefix {
			case "page":
				got = data["sections"].([]any)[0].(map[string]any)["content"]
			case "layout":
				got = data["header"].([]any)[0].(map[string]any)["content"]
				fallback := data["footer"].([]any)[0].(map[string]any)["content"]
				if !reflect.DeepEqual(fallback, collisionContent("default")) {
					t.Errorf("pass %d default layout content: got=%#v", pass, fallback)
				}
			}
			// Site/default exports retain canonical page references. Compare the
			// destination while checking that both colliding links target Home.
			content := got.(map[string]any)
			for _, link := range []map[string]any{
				content["cta"].(map[string]any),
				content["items"].([]any)[1].(map[string]any)["cta"].(map[string]any),
			} {
				if pageID, exists := link["page"]; exists {
					if pageID != ids["pages/"] {
						t.Errorf("pass %d %s link targets wrong page: %#v", pass, target.file, link)
					}
					delete(link, "page")
					link["url"] = "/"
				}
			}
			if !reflect.DeepEqual(got, collisionContent(target.prefix)) {
				t.Errorf("pass %d %s content: got=%#v want=%#v", pass, target.file, got, collisionContent(target.prefix))
			}
		}
		currentSchemas := map[string]string{}
		for _, file := range []string{"blocks/hero/fields.yaml", "site/fields.yaml"} {
			currentSchemas[file] = readZipFile(t, exported, file)
		}
		if schemas == nil {
			schemas = currentSchemas
		} else if !reflect.DeepEqual(schemas, currentSchemas) {
			t.Fatalf("pass %d schemas changed", pass)
		}
		if pass >= 2 {
			archive = exported
		}
	}
}

func TestImportFieldScopesLibraryRoundTrip(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	files := map[string]string{
		"library/groups.yaml":                "- name: Test\n  folder: test\n",
		"library/test/hero/config.yaml":      "name: hero\n",
		"library/test/hero/component.svelte": "<section>{body}</section>\n",
		"library/test/hero/fields.yaml":      collisionFieldsYAML(),
		"library/test/hero/content.yaml":     scopeYAML(t, collisionContent("library")),
	}
	archive := zipFiles(t, files)
	var originalFields string
	for pass := 0; pass < 3; pass++ {
		if _, err := processLibraryImport(app, archive, DeletesManifest{}); err != nil {
			t.Fatal(err)
		}
		exported, err := exportLibraryToZip(app)
		if err != nil {
			t.Fatal(err)
		}
		var content map[string]any
		if err := yaml.Unmarshal([]byte(readZipFile(t, exported, "library/test/hero/content.yaml")), &content); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(content, collisionContent("library")) {
			t.Fatalf("pass %d library content: got=%#v", pass, content)
		}
		fields := readZipFile(t, exported, "library/test/hero/fields.yaml")
		if pass == 0 {
			originalFields = fields
		} else if fields != originalFields {
			t.Fatalf("pass %d library schema/IDs changed", pass)
		}
		archive = exported
	}
}

func scopeFieldIdentities(t *testing.T, app core.App, site *core.Record) map[string]string {
	t.Helper()
	ids := map[string]string{}
	for collection, filter := range map[string]string{
		"site_fields": "site = {:site}", "site_symbol_fields": "symbol.site = {:site}",
		"site_symbols": "site = {:site}", "page_types": "site = {:site}",
		"pages": "site = {:site}", "page_sections": "page.site = {:site}",
	} {
		records, err := app.FindRecordsByFilter(collection, filter, "", 0, 0, map[string]any{"site": site.Id})
		if err != nil {
			t.Fatal(err)
		}
		byID := map[string]*core.Record{}
		for _, record := range records {
			byID[record.Id] = record
		}
		for _, record := range records {
			key := collection + "/" + buildBlockFieldCompositeKey(record, byID)
			if _, exists := ids[key]; exists {
				t.Fatalf("duplicate field path %s", key)
			}
			ids[key] = record.Id
		}
	}
	return ids
}

func TestImportFieldScopesUnknownWarnings(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["blocks/hero/fields.yaml"] = collisionFieldsYAML()
	content := collisionContent("page")
	content["unknown"] = "warn at root"
	content["details"] = "nested-only name must not resolve at root"
	content["items"].([]any)[0].(map[string]any)["unknown"] = "warn in repeater"
	content["left"].(map[string]any)["unknown"] = "warn in group"
	content["right"].(map[string]any)["details"].(map[string]any)["unknown"] = "warn deeper"
	files["pages/index.yaml"] = scopeYAML(t, map[string]any{
		"name": "Home", "page_type": "Default",
		"sections": []any{map[string]any{"block": "hero", "content": content}},
	})
	delete(files, "pages/vs/index.yaml")
	delete(files, "pages/vs/wordpress.yaml")
	want := map[string]bool{}
	for _, path := range []string{"unknown", "details", "items[0].unknown", "left.unknown", "right.details.unknown"} {
		want["sections[0].content."+path] = true
	}
	result, err := processImport(app, site, zipFiles(t, files), false)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	if len(result.Warnings) != len(want) {
		t.Errorf("expected %d warnings, got %+v", len(want), result.Warnings)
	}
	for _, warning := range result.Warnings {
		if warning.Kind != "orphaned_field" || warning.File != "pages/index.yaml" || warning.Block != "hero" {
			t.Errorf("unexpected warning: %+v", warning)
		}
		got[warning.Path] = true
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("warning paths: got=%v want=%v", got, want)
	}
}
