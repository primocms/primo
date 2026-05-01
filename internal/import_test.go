package internal

import (
	"archive/zip"
	"bytes"
	"io"
	"reflect"
	"strings"
	"testing"

	_ "github.com/palacms/palacms/migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

func TestImportReimportsBlockFieldsBeforePageContent(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	firstImport := map[string]string{
		"blocks/hero/config.yaml":        "name: hero\n",
		"blocks/hero/component.svelte":   "<section>{heading}</section>\n",
		"blocks/hero/fields.yaml":        "[]\n",
		"blocks/hero/content.yaml":       "{}\n",
		"page-types/default/config.yaml": "name: Default\nallowed_blocks:\n  - hero\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml":               "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":               "[]\n",
		"site/content.yaml":              "{}\n",
	}

	if _, err := processImport(app, site, zipFiles(t, firstImport), false); err != nil {
		t.Fatalf("first import: %v", err)
	}

	secondImport := map[string]string{
		"blocks/hero/config.yaml":      "name: hero\n",
		"blocks/hero/component.svelte": "<section>{heading}</section>\n",
		"blocks/hero/fields.yaml": "" +
			"- name: heading\n" +
			"  label: Heading\n" +
			"  type: text\n",
		"blocks/hero/content.yaml":       "{}\n",
		"page-types/default/config.yaml": "name: Default\nallowed_blocks:\n  - hero\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml": "" +
			"name: Home\n" +
			"page_type: Default\n" +
			"sections:\n" +
			"  - block: hero\n" +
			"    content:\n" +
			"      heading: Persist me\n",
		"site/fields.yaml":  "[]\n",
		"site/content.yaml": "{}\n",
	}

	result, err := processImport(app, site, zipFiles(t, secondImport), false)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if len(result.Warnings) > 0 {
		t.Fatalf("expected no import warnings, got %#v", result.Warnings)
	}

	fields, err := app.FindRecordsByFilter("site_symbol_fields", "symbol.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch symbol fields: %v", err)
	}
	if len(fields) != 1 || fields[0].GetString("key") != "heading" {
		t.Fatalf("expected heading field to be imported, got %#v", fields)
	}

	exportedZip, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatalf("export site: %v", err)
	}
	pageYAML := readZipFile(t, exportedZip, "pages/index.yaml")
	var page struct {
		Sections []struct {
			Content map[string]any `yaml:"content"`
		} `yaml:"sections"`
	}
	if err := yaml.Unmarshal([]byte(pageYAML), &page); err != nil {
		t.Fatalf("parse exported page: %v\n%s", err, pageYAML)
	}
	if len(page.Sections) != 1 {
		t.Fatalf("expected one exported section, got %#v", page.Sections)
	}
	if got := page.Sections[0].Content["heading"]; got != "Persist me" {
		t.Fatalf("expected heading content to survive export, got %#v\n%s", got, pageYAML)
	}
}

func TestImportReimportsPageTypeFieldsBeforePageContent(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	firstImport := map[string]string{
		"page-types/default/config.yaml": "name: Default\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml":               "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":               "[]\n",
		"site/content.yaml":              "{}\n",
	}

	if _, err := processImport(app, site, zipFiles(t, firstImport), false); err != nil {
		t.Fatalf("first import: %v", err)
	}

	secondImport := map[string]string{
		"page-types/default/config.yaml": "name: Default\n",
		"page-types/default/fields.yaml": "" +
			"- name: seo_title\n" +
			"  label: SEO title\n" +
			"  type: text\n" +
			"- name: seo_description\n" +
			"  label: SEO description\n" +
			"  type: textarea\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml": "" +
			"name: Home\n" +
			"page_type: Default\n" +
			"content:\n" +
			"  seo_title: Persist SEO\n" +
			"  seo_description: Stays here\n" +
			"sections: []\n",
		"site/fields.yaml":  "[]\n",
		"site/content.yaml": "{}\n",
	}

	result, err := processImport(app, site, zipFiles(t, secondImport), false)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if len(result.Warnings) > 0 {
		t.Fatalf("expected no import warnings, got %#v", result.Warnings)
	}

	fields, err := app.FindRecordsByFilter("page_type_fields", "page_type.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch page type fields: %v", err)
	}
	fieldKeys := make(map[string]bool, len(fields))
	for _, field := range fields {
		fieldKeys[field.GetString("key")] = true
	}
	if !fieldKeys["seo_title"] || !fieldKeys["seo_description"] {
		t.Fatalf("expected SEO page type fields to be imported, got %#v", fieldKeys)
	}

	exportedZip, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatalf("export site: %v", err)
	}
	pageYAML := readZipFile(t, exportedZip, "pages/index.yaml")
	var page struct {
		Content map[string]any `yaml:"content"`
		Fields  map[string]any `yaml:"fields"`
	}
	if err := yaml.Unmarshal([]byte(pageYAML), &page); err != nil {
		t.Fatalf("parse exported page: %v\n%s", err, pageYAML)
	}
	if got := page.Content["seo_title"]; got != "Persist SEO" {
		t.Fatalf("expected seo_title content to survive export, got %#v\n%s", got, pageYAML)
	}
	if got := page.Content["seo_description"]; got != "Stays here" {
		t.Fatalf("expected seo_description content to survive export, got %#v\n%s", got, pageYAML)
	}
	if len(page.Fields) > 0 {
		t.Fatalf("expected page type values to export as content, got legacy fields %#v\n%s", page.Fields, pageYAML)
	}
}

func TestImportExportPageTypeConfigUsesUnderscoreID(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	files := map[string]string{
		"page-types/default/config.yaml": "" +
			"_id: canonical123456\n" +
			"name: Default\n" +
			"icon: mdi:file-document-outline\n" +
			"color: \"#2B407D\"\n" +
			"allowed_blocks: []\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml":               "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":               "[]\n",
		"site/content.yaml":              "{}\n",
	}

	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatalf("import page type with _id key: %v", err)
	}

	exportedZip, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatalf("export site: %v", err)
	}

	configYAML := readZipFile(t, exportedZip, "page-types/default/config.yaml")
	if !strings.HasPrefix(configYAML, "_id: ") {
		t.Fatalf("expected exported page-type config to start with _id, got:\n%s", configYAML)
	}

	var config map[string]any
	if err := yaml.Unmarshal([]byte(configYAML), &config); err != nil {
		t.Fatalf("parse exported page type config: %v\n%s", err, configYAML)
	}
	if _, ok := config["_id"]; !ok {
		t.Fatalf("expected exported page-type config to contain _id, got %#v\n%s", config, configYAML)
	}
	if _, ok := config["id"]; ok {
		t.Fatalf("expected exported page-type config to omit legacy id key, got %#v\n%s", config, configYAML)
	}
}

func TestImportRejectsPageTypeConfigLegacyID(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	files := map[string]string{
		"page-types/default/config.yaml": "id: legacy123456789\nname: Default\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml":               "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":               "[]\n",
		"site/content.yaml":              "{}\n",
	}

	_, err := processImport(app, site, zipFiles(t, files), false)
	if err == nil {
		t.Fatal("expected import to reject page type config with legacy id key")
	}
	if !strings.Contains(err.Error(), "unsupported property `id`") {
		t.Fatalf("expected unsupported id error, got %v", err)
	}
}

func TestImportExportScaffoldBlockFieldsRoundTrip(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	scaffoldedFieldsYAML := "" +
		"- name: headline\n" +
		"  label: Headline\n" +
		"  type: text\n" +
		"- name: cta\n" +
		"  label: Cta\n" +
		"  type: link\n" +
		"- name: features\n" +
		"  label: Features\n" +
		"  type: repeater\n" +
		"  subfields:\n" +
		"    - name: title\n" +
		"      label: Title\n" +
		"      type: text\n" +
		"    - name: description\n" +
		"      label: Description\n" +
		"      type: text\n"

	files := map[string]string{
		"blocks/pricing-table/config.yaml": "name: Pricing Table\n",
		"blocks/pricing-table/component.svelte": "" +
			"<script>\n" +
			"  let { headline, cta, features } = $props();\n" +
			"</script>\n" +
			"\n" +
			"<section>{headline}</section>\n",
		"blocks/pricing-table/fields.yaml":  scaffoldedFieldsYAML,
		"blocks/pricing-table/content.yaml": "headline: \"\"\ncta:\n  url: \"\"\n  label: \"\"\nfeatures: []\n",
		"page-types/default/config.yaml":    "name: Default\nallowed_blocks:\n  - pricing-table\n",
		"page-types/default/fields.yaml":    "[]\n",
		"page-types/default/layout.yaml":    "{}\n",
		"pages/index.yaml":                  "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":                  "[]\n",
		"site/content.yaml":                 "{}\n",
	}

	result, err := processImport(app, site, zipFiles(t, files), false)
	if err != nil {
		t.Fatalf("import scaffolded block: %v", err)
	}
	if len(result.Warnings) > 0 {
		t.Fatalf("expected no import warnings, got %#v", result.Warnings)
	}

	exportedZip, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatalf("export site: %v", err)
	}

	exportedFieldsYAML := readZipFile(t, exportedZip, "blocks/pricing-table/fields.yaml")
	expected := normalizeFieldsYAMLForComparison(t, scaffoldedFieldsYAML)
	actual := normalizeFieldsYAMLForComparison(t, exportedFieldsYAML)
	if !reflect.DeepEqual(expected, actual) {
		t.Fatalf("expected scaffolded fields.yaml to round-trip schema-equivalent\nexpected: %#v\nactual:   %#v\nexported YAML:\n%s", expected, actual, exportedFieldsYAML)
	}
}

func TestImportReturnsPageTypeConfigIDForWriteBack(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	files := map[string]string{
		"page-types/default/config.yaml": "name: Default\nallowed_blocks: []\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml":               "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":               "[]\n",
		"site/content.yaml":              "{}\n",
	}

	result, err := processImport(app, site, zipFiles(t, files), false)
	if err != nil {
		t.Fatalf("import page type without _id: %v", err)
	}

	created := result.CreatedIDs["page-types/default/config.yaml"]
	if created == nil || created["_id"] == "" {
		t.Fatalf("expected page type config _id in created IDs, got %#v", result.CreatedIDs)
	}
}

func TestImportMatchesBlockByConfigIDAndUpdatesName(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	firstImport := map[string]string{
		"blocks/hero/config.yaml":        "name: Hero\n",
		"blocks/hero/component.svelte":   "<section>{heading}</section>\n",
		"blocks/hero/fields.yaml":        "[]\n",
		"blocks/hero/content.yaml":       "{}\n",
		"page-types/default/config.yaml": "name: Default\nallowed_blocks:\n  - hero\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml":               "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":               "[]\n",
		"site/content.yaml":              "{}\n",
	}

	if _, err := processImport(app, site, zipFiles(t, firstImport), false); err != nil {
		t.Fatalf("first import: %v", err)
	}

	symbols, err := app.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch symbols after first import: %v", err)
	}
	if len(symbols) != 1 {
		t.Fatalf("expected one symbol after first import, got %#v", symbols)
	}
	blockID := symbols[0].Id

	secondImport := map[string]string{
		"blocks/hero-renamed/config.yaml":      "_id: " + blockID + "\nname: Hero Renamed\n",
		"blocks/hero-renamed/component.svelte": "<section>{heading}</section>\n",
		"blocks/hero-renamed/fields.yaml":      "[]\n",
		"blocks/hero-renamed/content.yaml":     "{}\n",
		"page-types/default/config.yaml":       "name: Default\nallowed_blocks:\n  - hero-renamed\n",
		"page-types/default/fields.yaml":       "[]\n",
		"page-types/default/layout.yaml":       "{}\n",
		"pages/index.yaml":                     "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":                     "[]\n",
		"site/content.yaml":                    "{}\n",
	}

	if _, err := processImport(app, site, zipFiles(t, secondImport), false); err != nil {
		t.Fatalf("second import: %v", err)
	}

	symbols, err = app.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch symbols after second import: %v", err)
	}
	if len(symbols) != 1 {
		t.Fatalf("expected import to reuse existing block by _id, got %#v", symbols)
	}
	if symbols[0].Id != blockID {
		t.Fatalf("expected block ID %s to be preserved, got %s", blockID, symbols[0].Id)
	}
	if got := symbols[0].GetString("name"); got != "Hero Renamed" {
		t.Fatalf("expected block display name to update, got %q", got)
	}
}

func newImportTestApp(t *testing.T) *pocketbase.PocketBase {
	t.Helper()

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: t.TempDir(),
		DefaultDev:     true,
	})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("bootstrap test app: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("run app migrations: %v", err)
	}
	return app
}

func createImportTestSite(t *testing.T, app *pocketbase.PocketBase) *core.Record {
	t.Helper()

	groupID, err := ensureDefaultGroup(app)
	if err != nil {
		t.Fatalf("create default group: %v", err)
	}

	sites, err := app.FindCollectionByNameOrId("sites")
	if err != nil {
		t.Fatalf("find sites collection: %v", err)
	}
	site := core.NewRecord(sites)
	site.Set("name", "Import Test")
	site.Set("host", "import-test.localhost")
	site.Set("group", groupID)
	if err := app.Save(site); err != nil {
		t.Fatalf("save test site: %v", err)
	}
	return site
}

func zipFiles(t *testing.T, files map[string]string) []byte {
	t.Helper()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("create zip entry %s: %v", name, err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatalf("write zip entry %s: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

func readZipFile(t *testing.T, zipData []byte, name string) string {
	t.Helper()

	zr, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		t.Fatalf("open zip: %v", err)
	}
	for _, f := range zr.File {
		if f.Name != name {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open zip entry %s: %v", name, err)
		}
		defer rc.Close()
		data, err := io.ReadAll(rc)
		if err != nil {
			t.Fatalf("read zip entry %s: %v", name, err)
		}
		return string(data)
	}
	t.Fatalf("missing zip entry %s", name)
	return ""
}

func normalizeFieldsYAMLForComparison(t *testing.T, yamlText string) []map[string]interface{} {
	t.Helper()

	var doc interface{}
	if err := yaml.Unmarshal([]byte(yamlText), &doc); err != nil {
		t.Fatalf("parse fields yaml: %v\n%s", err, yamlText)
	}

	fields, ok := doc.([]interface{})
	if !ok {
		t.Fatalf("fields.yaml must be a bare list, got %T\n%s", doc, yamlText)
	}

	return normalizeFieldEntriesForComparison(t, fields)
}

func normalizeFieldEntriesForComparison(t *testing.T, entries []interface{}) []map[string]interface{} {
	t.Helper()

	normalized := make([]map[string]interface{}, 0, len(entries))
	for _, entry := range entries {
		field, ok := entry.(map[string]interface{})
		if !ok {
			t.Fatalf("field entry must be an object, got %T", entry)
		}

		out := make(map[string]interface{})
		for _, key := range []string{"name", "label", "type", "config"} {
			if value, ok := field[key]; ok {
				out[key] = value
			}
		}

		if subfields, ok := field["subfields"]; ok {
			out["subfields"] = normalizeFieldEntriesForComparison(t, asInterfaceSlice(t, subfields))
		}

		normalized = append(normalized, out)
	}

	return normalized
}

func asInterfaceSlice(t *testing.T, value interface{}) []interface{} {
	t.Helper()

	items, ok := value.([]interface{})
	if !ok {
		t.Fatalf("subfields must be a list, got %T", value)
	}
	return items
}
