package internal

import (
	"github.com/pocketbase/pocketbase/core"
	"testing"
)

func TestExportRetainsCMSSourceEditsAfterFileImport(t *testing.T) {
	for _, library := range []bool{false, true} {
		name := "site"
		if library {
			name = "library"
		}
		t.Run(name, func(t *testing.T) {
			app := newImportTestApp(t)
			defer app.ResetBootstrapState()
			raw := "<!-- authored formatting -->\n<script>\n let headline = 'Original'\n</script>\n\n<h1>{headline}</h1>\n<style>h1 { color: red }</style>\n"
			var symbol *core.Record
			var export func() ([]byte, error)
			file := "blocks/hero/component.svelte"
			if library {
				coll, err := app.FindCollectionByNameOrId("library_symbol_groups")
				if err != nil {
					t.Fatal(err)
				}
				group := core.NewRecord(coll)
				group.Set("name", "Components")
				if err := app.Save(group); err != nil {
					t.Fatal(err)
				}
				if err := importLibraryBlock(app, group, "hero", "Hero", []byte(raw), nil, nil, nil); err != nil {
					t.Fatal(err)
				}
				symbols, err := app.FindAllRecords("library_symbols")
				if err != nil {
					t.Fatal(err)
				}
				symbol = symbols[0]
				file = "library/components/hero/component.svelte"
				export = func() ([]byte, error) { return exportLibraryToZip(app) }
			} else {
				site := createImportTestSite(t, app)
				files := baseSiteFiles()
				files[file] = raw
				if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
					t.Fatal(err)
				}
				symbols, err := app.FindAllRecords("site_symbols")
				if err != nil {
					t.Fatal(err)
				}
				symbol = symbols[0]
				export = func() ([]byte, error) { return exportSiteToZip(app, site) }
			}
			archive, err := export()
			if err != nil {
				t.Fatal(err)
			}
			if got := readZipFile(t, archive, file); got != raw {
				t.Fatalf("unchanged source lost authored bytes: %q", got)
			}
			// Browser code editing changes parsed columns while retaining imported raw_source.
			// Test each column independently, including deletion, so no stale portion wins.
			for _, edit := range []struct{ field, value string }{{"html", "<h2>Visual edit</h2>"}, {"css", "h2 { color: blue }"}, {"js", "let headline = 'Updated'"}, {"html", ""}, {"html", "<h2>Final</h2>"}, {"js", ""}, {"css", ""}} {
				symbol.Set(edit.field, edit.value)
				if err := app.Save(symbol); err != nil {
					t.Fatal(err)
				}
				archive, err = export()
				if err != nil {
					t.Fatal(err)
				}
				source := readZipFile(t, archive, file)
				html, css, js := parseComponent(source)
				if html != symbol.GetString("html") || css != symbol.GetString("css") || js != symbol.GetString("js") {
					t.Fatalf("%s edit exported stale source: html=%q css=%q js=%q", edit.field, html, css, js)
				}
				// The export is read-only; it must not erase the imported source receipt.
				if symbol.GetString("raw_source") != raw {
					t.Fatal("export mutated raw source")
				}
			}
		})
	}
}
