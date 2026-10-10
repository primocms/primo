package internal

import (
	"fmt"
	"testing"

	"github.com/pocketbase/dbx"
	"gopkg.in/yaml.v3"
)

func TestExportEmptyRepeaterItemsRoundTrip(t *testing.T) {
	for _, allEmpty := range []bool{false, true} {
		t.Run(fmt.Sprintf("all_empty_%t", allEmpty), func(t *testing.T) {
			app := newImportTestApp(t)
			defer app.ResetBootstrapState()
			site := createImportTestSite(t, app)
			files := baseSiteFiles()
			delete(files, "pages/vs/index.yaml")
			delete(files, "pages/vs/wordpress.yaml")
			fields := "- name: items\n  type: repeater\n  subfields:\n    - name: body\n      type: text\n"
			content := map[string]any{"items": []any{
				map[string]any{"body": "first"}, map[string]any{"body": "middle"}, map[string]any{"body": "last"},
			}}
			files["blocks/hero/fields.yaml"] = fields
			files["blocks/hero/content.yaml"] = scopeYAML(t, content)
			files["site/fields.yaml"] = fields
			files["site/content.yaml"] = scopeYAML(t, content)
			files["pages/index.yaml"] = scopeYAML(t, map[string]any{
				"name": "Home", "page_type": "Default",
				"sections": []any{map[string]any{"block": "hero", "content": content}},
			})
			files["page-types/default/layout.yaml"] = scopeYAML(t, map[string]any{
				"header": []any{map[string]any{"block": "hero", "content": content}},
			})
			if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
				t.Fatal(err)
			}

			// Model empty items created in the editor: their container entries
			// exist, but they have no child values. Cover every exporter caller.
			for _, collection := range []string{"site_entries", "site_symbol_entries", "page_section_entries", "page_type_section_entries"} {
				children, err := app.FindRecordsByFilter(collection, "parent != ''", "", 0, 0, nil)
				if err != nil {
					t.Fatal(err)
				}
				for _, child := range children {
					parent, err := app.FindRecordById(collection, child.GetString("parent"))
					if err != nil {
						t.Fatal(err)
					}
					if allEmpty || parent.GetInt("index") != 1 {
						if err := app.Delete(child); err != nil {
							t.Fatal(err)
						}
					}
				}
			}

			for pass := 0; pass < 2; pass++ {
				archive, err := exportSiteToZip(app, site)
				if err != nil {
					t.Fatal(err)
				}
				for _, file := range []string{"site/content.yaml", "blocks/hero/content.yaml", "pages/index.yaml", "page-types/default/layout.yaml"} {
					var exported map[string]any
					raw := readZipFile(t, archive, file)
					if err := yaml.Unmarshal([]byte(raw), &exported); err != nil {
						t.Fatal(err)
					}
					values := exported
					if file == "pages/index.yaml" {
						values = exported["sections"].([]any)[0].(map[string]any)["content"].(map[string]any)
					} else if file == "page-types/default/layout.yaml" {
						values = exported["header"].([]any)[0].(map[string]any)["content"].(map[string]any)
					}
					items, ok := values["items"].([]any)
					if !ok || len(items) != 3 {
						t.Fatalf("pass %d, %s: empty items were lost: %s", pass, file, raw)
					}
					for index, value := range items {
						item, ok := value.(map[string]any)
						if !ok {
							t.Fatalf("%s item %d should be an object, got %#v", file, index, value)
						}
						if !allEmpty && index == 1 {
							if item["body"] != "middle" {
								t.Fatalf("%s: populated item moved or changed: %#v", file, items)
							}
						} else if pass == 0 && len(item) != 0 {
							t.Fatalf("%s: blank item should export as {}, got %#v", file, item)
						}
					}
				}
				if pass == 0 {
					if _, err := processImport(app, site, archive, false); err != nil {
						t.Fatal(err)
					}
					entries, err := app.FindRecordsByFilter("site_entries", "field.site = {:site} && parent = ''", "index", 0, 0, dbx.Params{"site": site.Id})
					if err != nil || len(entries) != 3 {
						t.Fatalf("reimport lost item containers: count %d, error %v", len(entries), err)
					}
				}
			}
		})
	}
}
