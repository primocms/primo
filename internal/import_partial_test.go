package internal

import (
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

// TestPartialImportPreservesParentsAndSections verifies that page-only uploads
// update content without detaching routes or replacing sections, including
// nested pages and blocks with renamed display labels.
func TestPartialImportPreservesParentsAndSections(t *testing.T) {
	for _, renamed := range []bool{false, true} {
		for _, file := range []string{"pages/vs/index.yaml", "pages/vs/wordpress.yaml"} {
			t.Run(fmt.Sprintf("renamed=%t/%s", renamed, file), func(t *testing.T) {
				app := newImportTestApp(t)
				defer app.ResetBootstrapState()
				site := createImportTestSite(t, app)
				files := baseSiteFiles()
				if renamed {
					files["blocks/hero/config.yaml"] = "name: A completely different display name\n"
				}
				if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
					t.Fatal(err)
				}
				exported, err := exportSiteToZip(app, site)
				if err != nil {
					t.Fatal(err)
				}
				var page ExportedPage
				source := readZipFile(t, exported, file)
				if err := yaml.Unmarshal([]byte(source), &page); err != nil {
					t.Fatal(err)
				}
				before, err := app.FindRecordById("pages", page.ID)
				if err != nil {
					t.Fatal(err)
				}
				sections, err := existingPageSectionIds(app, page.ID)
				if err != nil {
					t.Fatal(err)
				}
				if len(sections) != 1 {
					t.Fatalf("fixture sections: %v", sections)
				}
				// Neither the homepage, parent page, nor block definition is in the ZIP.
				content := page.Sections[0]["content"].(map[string]interface{})
				oldHeading := content["heading"].(string)
				content["heading"] = "Updated by partial upload"
				partial := map[string]string{file: strings.Replace(source, "heading: "+oldHeading, "heading: Updated by partial upload", 1)}
				for _, preview := range []bool{true, false} {
					result, err := processImport(app, site, zipFiles(t, partial), preview)
					if err != nil {
						t.Fatal(err)
					}
					if len(result.Warnings) > 0 {
						t.Fatalf("unexpected warnings: %+v", result.Warnings)
					}
					after, err := app.FindRecordById("pages", page.ID)
					if err != nil {
						t.Fatal(err)
					}
					if after.GetString("parent") != before.GetString("parent") {
						t.Fatalf("partial import detached page: got parent %q, want %q", after.GetString("parent"), before.GetString("parent"))
					}
					actual, err := existingPageSectionIds(app, page.ID)
					if err != nil {
						t.Fatal(err)
					}
					if !reflect.DeepEqual(actual, sections) {
						t.Fatalf("section identities changed: got %v, want %v", actual, sections)
					}
				}
				current, err := exportSiteToZip(app, site)
				if err != nil {
					t.Fatal(err)
				}
				var got ExportedPage
				if err := yaml.Unmarshal([]byte(readZipFile(t, current, file)), &got); err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(page.Sections, got.Sections) {
					t.Fatalf("section content changed: got %#v, want %#v", got.Sections, page.Sections)
				}
			})
		}
	}
}

// TestPartialImportRejectsUnresolvedReferences checks that preview and apply
// reject missing block or parent dependencies without changing the draft.
func TestPartialImportRejectsUnresolvedReferences(t *testing.T) {
	for _, kind := range []string{"block", "parent", "homepage"} {
		for _, preview := range []bool{true, false} {
			t.Run(fmt.Sprintf("%s/preview=%t", kind, preview), func(t *testing.T) {
				app := newImportTestApp(t)
				defer app.ResetBootstrapState()
				site := createImportTestSite(t, app)
				files := baseSiteFiles()
				if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
					t.Fatal(err)
				}
				exported, err := exportSiteToZip(app, site)
				if err != nil {
					t.Fatal(err)
				}
				source := readZipFile(t, exported, "pages/vs/index.yaml")
				file := "pages/vs/index.yaml"
				switch kind {
				case "block":
					source = strings.ReplaceAll(source, "block: hero", "block: absent-block")
				case "parent":
					file = "pages/missing-parent/vs.yaml"
				case "homepage":
					// A fresh site cannot import a child as a second implicit homepage.
					site.Set("host", "previous.localhost")
					site.Set("name", "Previous site")
					if err := app.Save(site); err != nil {
						t.Fatal(err)
					}
					site = createImportTestSite(t, app)
					source = "name: Child\nsections: []\n"
					file = "pages/child.yaml"
				}
				before, err := readPushState(app, site.Id)
				if err != nil {
					t.Fatal(err)
				}
				err = app.RunInTransaction(func(tx core.App) error {
					_, err := processImport(tx, site, zipFiles(t, map[string]string{file: source}), preview)
					return err
				})
				if err == nil {
					t.Fatal("expected an actionable error instead of silently skipping content")
				}
				if !strings.Contains(err.Error(), file) {
					t.Fatalf("error should identify the file: %v", err)
				}
				after, err := readPushState(app, site.Id)
				if err != nil {
					t.Fatal(err)
				}
				if after != before {
					t.Fatalf("failed import changed draft: before=%+v after=%+v", before, after)
				}
			})
		}
	}
}

// TestPartialPageTypeImportResolvesExistingBlockFolder verifies that a page-type
// upload retains shared-layout and allowed-block references when the renamed
// block’s definition is omitted from the archive.
func TestPartialPageTypeImportResolvesExistingBlockFolder(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["blocks/hero/config.yaml"] = "name: Renamed block\n"
	files["page-types/default/layout.yaml"] = "header:\n  - block: hero\n    content:\n      heading: Shared heading\n"
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	exported, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	partial := map[string]string{}
	for _, name := range []string{"config.yaml", "fields.yaml", "layout.yaml"} {
		file := "page-types/default/" + name
		partial[file] = readZipFile(t, exported, file)
	}
	result, err := processImport(app, site, zipFiles(t, partial), false)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Warnings) > 0 {
		t.Fatalf("unexpected warnings: %+v", result.Warnings)
	}
	after, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	for _, file := range []string{"page-types/default/config.yaml", "page-types/default/layout.yaml"} {
		var want, got interface{}
		if err := yaml.Unmarshal([]byte(readZipFile(t, exported, file)), &want); err != nil {
			t.Fatal(err)
		}
		if err := yaml.Unmarshal([]byte(readZipFile(t, after, file)), &got); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(want, got) {
			t.Fatalf("partial page-type upload lost references in %s: want %#v, got %#v", file, want, got)
		}
	}
}
