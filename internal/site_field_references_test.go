package internal

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

func TestSharedSiteFieldReferencesRoundTrip(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["site/fields.yaml"] = `- name: nav_links
  type: repeater
  subfields:
    - name: link
      type: link
- name: footer_groups
  type: repeater
  subfields:
    - name: title
      type: text
    - name: links
      type: repeater
      subfields:
        - name: link
          type: link
- name: brand
  type: group
  subfields:
    - name: name
      type: text
    - name: nav_links
      type: text
- name: notice
  type: text
- name: count
  type: number
- name: enabled
  type: switch
- name: logo
  type: image
`
	files["site/content.yaml"] = `nav_links:
  - link: { url: 'https://example.com/about', label: About }
footer_groups:
  - title: Explore
    links:
      - link: { url: 'https://example.com/help', label: Help }
brand: { name: Primo, nav_links: Nested decoy }
notice: Shared copyright
count: 0
enabled: false
logo: { url: 'https://example.com/logo.svg', alt: Shared logo }
`
	files["blocks/hero/fields.yaml"] = ""
	for _, key := range []string{"nav_links", "footer_groups", "brand", "notice", "count", "enabled", "logo"} {
		files["blocks/hero/fields.yaml"] += "- name: shared_" + key + "\n  type: site-field\n  config: { field: " + key + " }\n"
	}
	files["blocks/hero/content.yaml"] = "{}\n"
	files["blocks/hero/component.svelte"] = "<nav>{#each shared_nav_links as item}<a href={item.link.url}>{item.link.label}</a>{/each}</nav>"
	files["page-types/default/layout.yaml"] = "header:\n  - block: hero\nfooter:\n  - block: hero\n"
	files["pages/index.yaml"] = "name: Home\npage_type: Default\nsections: []\n"
	delete(files, "pages/vs/index.yaml")
	delete(files, "pages/vs/wordpress.yaml")
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	originalIDs := scopeFieldIdentities(t, app, site)
	assertRefs := func(app core.App, site *core.Record) {
		t.Helper()
		roots, err := app.FindRecordsByFilter("site_fields", "site = {:site} && parent = ''", "", 0, 0, map[string]any{"site": site.Id})
		if err != nil {
			t.Fatal(err)
		}
		byID := map[string]string{}
		for _, field := range roots {
			byID[field.Id] = field.GetString("key")
		}
		refs, err := app.FindRecordsByFilter("site_symbol_fields", "symbol.site = {:site} && type = 'site-field'", "", 0, 0, map[string]any{"site": site.Id})
		if err != nil {
			t.Fatal(err)
		}
		if len(refs) != 7 {
			t.Fatalf("got %d references", len(refs))
		}
		for _, field := range refs {
			var config map[string]any
			if err := json.Unmarshal([]byte(field.GetString("config")), &config); err != nil {
				t.Fatal(err)
			}
			if byID[config["field"].(string)] != strings.TrimPrefix(field.GetString("key"), "shared_") {
				t.Fatalf("incorrect root reference: %s", field.GetString("config"))
			}
		}
	}
	assertRefs(app, site)
	archive, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatal(err)
	}
	var expectedContent map[string]any
	if err := yaml.Unmarshal([]byte(readZipFile(t, archive, "site/content.yaml")), &expectedContent); err != nil {
		t.Fatal(err)
	}
	var authoredContent map[string]any
	if err := yaml.Unmarshal([]byte(files["site/content.yaml"]), &authoredContent); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(expectedContent, authoredContent) {
		t.Fatalf("source content lost: %#v", expectedContent)
	}
	exportedFields := readZipFile(t, archive, "blocks/hero/fields.yaml")
	for _, key := range []string{"nav_links", "footer_groups", "brand", "notice", "count", "enabled", "logo"} {
		if !strings.Contains(exportedFields, "field: "+key) {
			t.Fatalf("export must use portable key %s: %s", key, exportedFields)
		}
	}
	for pass := 0; pass < 2; pass++ {
		if _, err := processImport(app, site, archive, false); err != nil {
			t.Fatal(err)
		}
		assertRefs(app, site)
		if got := scopeFieldIdentities(t, app, site); !reflect.DeepEqual(got, originalIDs) {
			t.Fatalf("IDs changed: %#v != %#v", got, originalIDs)
		}
	}
	other := newImportTestApp(t)
	defer other.ResetBootstrapState()
	destination := createImportTestSite(t, other)
	if _, err := processImport(other, destination, archive, false); err != nil {
		t.Fatal(err)
	}
	assertRefs(other, destination)
	again, err := exportSiteToZip(other, destination)
	if err != nil {
		t.Fatal(err)
	}
	var after map[string]any
	if err := yaml.Unmarshal([]byte(readZipFile(t, again, "site/content.yaml")), &after); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(after, expectedContent) {
		t.Fatalf("round trip changed shared values: %#v", after)
	}
}

func TestPartialBlockUploadResolvesExistingSiteFieldKeysAndIDs(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := baseSiteFiles()
	files["site/fields.yaml"] = "- name: nav_links\n  type: text\n"
	files["site/content.yaml"] = "nav_links: Retained source\n"
	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatal(err)
	}
	roots, err := app.FindRecordsByFilter("site_fields", "site = {:site} && parent = ''", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(roots) != 1 {
		t.Fatalf("roots: %v %v", roots, err)
	}
	// A valid ID must not be redirected by another root using that ID as its key.
	decoy := core.NewRecord(roots[0].Collection())
	decoy.Set("site", site.Id)
	decoy.Set("key", roots[0].Id)
	decoy.Set("type", "text")
	if err := app.Save(decoy); err != nil {
		t.Fatal(err)
	}
	for _, reference := range []string{"nav_links", roots[0].Id, "missing-nav"} {
		partial := map[string]string{
			"blocks/hero/config.yaml":      "name: hero\n",
			"blocks/hero/component.svelte": "<nav>{navigation}</nav>",
			"blocks/hero/fields.yaml":      "- name: navigation\n  type: site-field\n  config: { field: " + reference + " }\n",
			"blocks/hero/content.yaml":     "{}\n",
		}
		result, err := processImport(app, site, zipFiles(t, partial), false)
		if err != nil {
			t.Fatal(err)
		}
		refs, err := app.FindRecordsByFilter("site_symbol_fields", "symbol.site = {:site} && key = 'navigation'", "", 0, 0, map[string]any{"site": site.Id})
		if err != nil || len(refs) != 1 {
			t.Fatalf("references: %v %v", refs, err)
		}
		if reference != "missing-nav" {
			if !strings.Contains(refs[0].GetString("config"), roots[0].Id) {
				t.Fatalf("reference not resolved: %s", refs[0].GetString("config"))
			}
			for _, warning := range result.Warnings {
				if strings.Contains(warning.Message, "Unresolved site-field") {
					t.Fatal(warning)
				}
			}
		} else {
			found := false
			for _, warning := range result.Warnings {
				if warning.File == "blocks/hero/fields.yaml" && warning.Path == "navigation.config.field" && strings.Contains(warning.Message, "missing-nav") && strings.Contains(warning.Message, "site/fields.yaml") {
					found = true
				}
			}
			if !found {
				t.Fatalf("missing diagnostic: %#v", result.Warnings)
			}
		}
	}
}
