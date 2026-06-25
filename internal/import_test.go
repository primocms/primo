package internal

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	_ "github.com/primocms/primo/migrations"
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
	// Page-level values import from legacy `content:` (above) but must export
	// under canonical `fields:`.
	if got := page.Fields["seo_title"]; got != "Persist SEO" {
		t.Fatalf("expected seo_title to survive export under fields, got %#v\n%s", got, pageYAML)
	}
	if got := page.Fields["seo_description"]; got != "Stays here" {
		t.Fatalf("expected seo_description to survive export under fields, got %#v\n%s", got, pageYAML)
	}
	if len(page.Content) > 0 {
		t.Fatalf("expected page type values to export as fields, got legacy content %#v\n%s", page.Content, pageYAML)
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

// TestUpdatedTimestampStableOnNoOpReimport answers a single question that
// determines whether per-record versioning can use PocketBase's native
// `updated` column or whether we need to add an explicit sync_version.
//
// If `updated` advances on records whose content is identical between two
// imports, the native column is dirty under transactional bulk save and the
// "use native updated" sync strategy collapses — every reimport would mark
// every record as remotely changed, defeating conflict detection. In that
// case we'd need explicit sync_version columns + manual bumps in every
// write path, which is a much larger project.
//
// Strategy: import a small site, capture updated timestamps for every
// syncable record, sleep one second to ensure any new write would produce
// a strictly later timestamp, import the exact same content again, and
// compare per-record. Any record whose updated advanced is a record that
// PocketBase touched even though its content didn't change.
func TestUpdatedTimestampStableOnNoOpReimport(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	files := map[string]string{
		"blocks/hero/config.yaml":      "name: hero\n",
		"blocks/hero/component.svelte": "<section>{heading}</section>\n",
		"blocks/hero/fields.yaml": "" +
			"- name: heading\n" +
			"  label: Heading\n" +
			"  type: text\n",
		"blocks/hero/content.yaml":       "heading: Default heading\n",
		"page-types/default/config.yaml": "name: Default\nallowed_blocks:\n  - hero\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "{}\n",
		"pages/index.yaml": "" +
			"name: Home\n" +
			"page_type: Default\n" +
			"sections:\n" +
			"  - block: hero\n" +
			"    content:\n" +
			"      heading: Hello world\n",
		"site/fields.yaml":  "[]\n",
		"site/content.yaml": "{}\n",
	}

	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatalf("first import: %v", err)
	}

	// Collections that the sync layer cares about. If any of these
	// advance on a no-op reimport, native `updated` is unusable for
	// conflict detection.
	syncCollections := []string{
		"sites",
		"site_symbols",
		"site_symbol_fields",
		"site_symbol_entries",
		"page_types",
		"pages",
		"page_sections",
	}

	type snapshot struct {
		ids      map[string]bool   // record IDs present in this collection
		updateds map[string]string // id -> updated timestamp
	}
	capture := func(label string) map[string]snapshot {
		out := map[string]snapshot{}
		for _, name := range syncCollections {
			records, err := app.FindRecordsByFilter(name, "1=1", "", 0, 0, nil)
			if err != nil {
				t.Fatalf("fetch %s %s: %v", name, label, err)
			}
			snap := snapshot{ids: map[string]bool{}, updateds: map[string]string{}}
			for _, r := range records {
				snap.ids[r.Id] = true
				snap.updateds[r.Id] = r.GetString("updated")
			}
			out[name] = snap
		}
		return out
	}

	before := capture("before")

	totalBefore := 0
	for _, snap := range before {
		totalBefore += len(snap.ids)
	}
	if totalBefore == 0 {
		t.Fatal("no records captured before reimport — test setup is wrong")
	}

	// Sleep enough that any genuine save would produce a strictly later
	// updated timestamp. PocketBase stores updated at second granularity
	// (or finer depending on config); 1.1s covers second-precision and
	// gives clear separation if it's finer.
	time.Sleep(1100 * time.Millisecond)

	if _, err := processImport(app, site, zipFiles(t, files), false); err != nil {
		t.Fatalf("second import: %v", err)
	}

	after := capture("after")

	var (
		recreatedCount int // record existed before, gone after; new record(s) appeared
		bumpedCount    int // same id, different updated
		stableCount    int // same id, same updated
	)
	bumpDetails := []string{}
	recreateDetails := []string{}

	for _, name := range syncCollections {
		beforeSnap := before[name]
		afterSnap := after[name]

		for id, beforeTs := range beforeSnap.updateds {
			if afterSnap.ids[id] {
				afterTs := afterSnap.updateds[id]
				if afterTs == beforeTs {
					stableCount++
				} else {
					bumpedCount++
					if len(bumpDetails) < 10 {
						bumpDetails = append(bumpDetails, name+"/"+id+" "+beforeTs+" -> "+afterTs)
					}
				}
			} else {
				recreatedCount++
				if len(recreateDetails) < 10 {
					recreateDetails = append(recreateDetails, name+"/"+id+" disappeared")
				}
			}
		}
	}

	t.Logf("Verification result: stable=%d bumped=%d recreated=%d (of %d total before)",
		stableCount, bumpedCount, recreatedCount, totalBefore)

	if recreatedCount > 0 {
		t.Logf("VERIFICATION FAILED (recreated): %d records had their IDs vanish on no-op reimport.", recreatedCount)
		t.Logf("PocketBase is delete+insert, not update-in-place, for these record types.")
		t.Logf("This is worse than `updated` drift — IDs aren't stable across reimports,")
		t.Logf("which means version tracking by ID is also unreliable for these collections.")
		for _, d := range recreateDetails {
			t.Logf("  %s", d)
		}
	}
	if bumpedCount > 0 {
		t.Logf("VERIFICATION FAILED (bumped): %d records had updated advance despite identical content.", bumpedCount)
		t.Logf("Native `updated` is unusable for sync versioning on these collections;")
		t.Logf("explicit sync_version columns + manual bumps would be required.")
		for _, d := range bumpDetails {
			t.Logf("  %s", d)
		}
	}

	if recreatedCount > 0 || bumpedCount > 0 {
		t.FailNow()
	}

	t.Logf("VERIFICATION PASSED: %d records, none drifted on no-op reimport.", stableCount)
	t.Logf("Native `updated` is safe to use as the sync version primitive.")
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

// zipFilesBinary is a parallel to zipFiles that accepts raw bytes per entry,
// for tests that need to ship non-UTF-8 content (e.g. image binaries).
func zipFilesBinary(t *testing.T, files map[string][]byte) []byte {
	t.Helper()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("create zip entry %s: %v", name, err)
		}
		if _, err := w.Write(content); err != nil {
			t.Fatalf("write zip entry %s: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

// fakePNG returns the smallest valid PNG payload that PocketBase's file
// validation will accept (1x1 transparent pixel). Using a real PNG avoids
// surprises where the file storage layer sniffs mime types or rejects
// zero-byte uploads.
func fakePNG() []byte {
	return []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
		0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
		0x42, 0x60, 0x82,
	}
}

func TestImportUploadsResolvesSymbolicPathAndRoundTrips(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	pngBytes := fakePNG()
	firstImport := map[string][]byte{
		"uploads/hero.png":               pngBytes,
		"blocks/hero/config.yaml":        []byte("name: hero\n"),
		"blocks/hero/component.svelte":   []byte("<section><img src={image.url} alt={image.alt} /></section>\n"),
		"blocks/hero/fields.yaml":        []byte("- name: image\n  label: Image\n  type: image\n"),
		"blocks/hero/content.yaml":       []byte("{}\n"),
		"page-types/default/config.yaml": []byte("name: Default\nallowed_blocks:\n  - hero\n"),
		"page-types/default/fields.yaml": []byte("[]\n"),
		"page-types/default/layout.yaml": []byte("{}\n"),
		"pages/index.yaml": []byte("" +
			"name: Home\n" +
			"page_type: Default\n" +
			"sections:\n" +
			"  - block: hero\n" +
			"    content:\n" +
			"      image:\n" +
			"        url: \"\"\n" +
			"        alt: A hero image\n" +
			"        upload: uploads/hero.png\n"),
		"site/fields.yaml":  []byte("[]\n"),
		"site/content.yaml": []byte("{}\n"),
	}

	result, err := processImport(app, site, zipFilesBinary(t, firstImport), false)
	if err != nil {
		t.Fatalf("first import: %v", err)
	}
	if len(result.Warnings) > 0 {
		t.Fatalf("expected no warnings on first import, got %#v", result.Warnings)
	}

	// CLI consumes created_ids["uploads/.manifest.json"]["_uploads"] to rename
	// local files and rewrite yaml symbolic refs. Verify the shape.
	manifestCreated, ok := result.CreatedIDs["uploads/.manifest.json"]
	if !ok {
		t.Fatalf("expected created_ids to include uploads/.manifest.json")
	}
	uploadsBlob, ok := manifestCreated["_uploads"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected _uploads map under uploads manifest, got %#v", manifestCreated)
	}
	heroEntry, ok := uploadsBlob["hero.png"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected hero.png entry under _uploads, got %#v", uploadsBlob)
	}
	if heroEntry["id"] == nil || heroEntry["id"] == "" {
		t.Fatalf("expected hero.png entry to carry an id, got %#v", heroEntry)
	}
	if canonical, _ := heroEntry["canonical"].(string); !strings.HasPrefix(canonical, "hero_") {
		t.Fatalf("expected canonical name like hero_xxx.png, got %#v", heroEntry["canonical"])
	}

	// The upload should have produced exactly one site_uploads record whose
	// filename matches what was on disk.
	uploads, err := app.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch uploads: %v", err)
	}
	if len(uploads) != 1 {
		t.Fatalf("expected 1 site_uploads record, got %d", len(uploads))
	}
	uploadRec := uploads[0]
	// PocketBase appends a random suffix to the stored filename, so the
	// extension and base name are stable but a 10-char hash sits between
	// them: hero.png → hero_xxxxxxxxxx.png.
	stored := uploadRec.GetString("file")
	if !strings.HasPrefix(stored, "hero_") || !strings.HasSuffix(stored, ".png") {
		t.Fatalf("expected stored filename like hero_xxx.png, got %q", stored)
	}
	// Confirm the binary actually landed on disk under the suffixed name.
	// The storage dir is keyed by collection id (not its name) and record id.
	storagePath := app.DataDir() + "/storage/" + uploadRec.Collection().Id + "/" + uploadRec.Id + "/" + stored
	if _, err := os.Stat(storagePath); err != nil {
		t.Fatalf("upload binary missing on disk: %s err=%v", storagePath, err)
	}

	// The page section entry that backs the `image` field should now hold the
	// upload record id, not the symbolic uploads/hero.png path.
	entries, err := app.FindRecordsByFilter("page_section_entries", "field.symbol.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch page section entries: %v", err)
	}
	var imageEntry *core.Record
	for _, e := range entries {
		raw := e.GetString("value")
		if strings.Contains(raw, "hero.png") || strings.Contains(raw, uploadRec.Id) {
			imageEntry = e
			break
		}
	}
	if imageEntry == nil {
		t.Fatalf("did not find image entry referencing the upload; entries: %d", len(entries))
	}
	rawValue := imageEntry.GetString("value")
	if !strings.Contains(rawValue, uploadRec.Id) {
		t.Fatalf("expected entry value to reference upload id %s, got %s", uploadRec.Id, rawValue)
	}
	if strings.Contains(rawValue, "uploads/hero.png") {
		t.Fatalf("symbolic path leaked into stored value: %s", rawValue)
	}

	// Round-trip: export and confirm both the manifest and the binary are in
	// the zip, then re-import that zip and confirm no new records or warnings.
	exportedZip, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatalf("export site: %v", err)
	}
	// Export uses the canonical (suffixed) name, mirroring what was on disk.
	exportedBinary := readZipFileBytes(t, exportedZip, "uploads/"+stored)
	if !bytes.Equal(exportedBinary, pngBytes) {
		t.Fatalf("exported upload bytes don't match: in=%d out=%d", len(pngBytes), len(exportedBinary))
	}
	manifestJSON := readZipFile(t, exportedZip, "uploads/.manifest.json")
	if !strings.Contains(manifestJSON, uploadRec.Id) {
		t.Fatalf("manifest missing upload id %s: %s", uploadRec.Id, manifestJSON)
	}
	if !strings.Contains(manifestJSON, stored) {
		t.Fatalf("manifest missing filename %s: %s", stored, manifestJSON)
	}

	uploadsBeforeReimport := len(uploads)
	reimportResult, err := processImport(app, site, exportedZip, false)
	if err != nil {
		t.Fatalf("re-import: %v", err)
	}
	for _, w := range reimportResult.Warnings {
		if w.Kind == "orphan_upload" {
			t.Fatalf("unexpected orphan_upload warning on no-op re-import: %#v", w)
		}
	}
	uploadsAfter, err := app.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch uploads after reimport: %v", err)
	}
	if len(uploadsAfter) != uploadsBeforeReimport {
		t.Fatalf("re-import created duplicate uploads: before=%d after=%d", uploadsBeforeReimport, len(uploadsAfter))
	}
}

func TestImportUploadsEmitsOrphanWarning(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	// Seed an upload via a first push.
	pngBytes := fakePNG()
	seed := map[string][]byte{
		"uploads/keep-me.png":            pngBytes,
		"blocks/hero/config.yaml":        []byte("name: hero\n"),
		"blocks/hero/component.svelte":   []byte("<section />\n"),
		"blocks/hero/fields.yaml":        []byte("[]\n"),
		"blocks/hero/content.yaml":       []byte("{}\n"),
		"page-types/default/config.yaml": []byte("name: Default\nallowed_blocks:\n  - hero\n"),
		"page-types/default/fields.yaml": []byte("[]\n"),
		"page-types/default/layout.yaml": []byte("{}\n"),
		"pages/index.yaml":               []byte("name: Home\npage_type: Default\nsections: []\n"),
		"site/fields.yaml":               []byte("[]\n"),
		"site/content.yaml":              []byte("{}\n"),
	}
	if _, err := processImport(app, site, zipFilesBinary(t, seed), false); err != nil {
		t.Fatalf("seed import: %v", err)
	}

	// After the seed push, the storage name is suffixed — pick it up from the
	// DB record so the orphan manifest references the same canonical name.
	seedRecs, err := app.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(seedRecs) != 1 {
		t.Fatalf("seed push didn't produce exactly one upload: %v err=%v", seedRecs, err)
	}
	seedFilename := seedRecs[0].GetString("file")

	// Push again with the manifest still mentioning the seed file, but the
	// binary missing from disk. Expect an orphan_upload warning and the
	// record to be preserved (no auto-deletion).
	manifestJSON := fmt.Sprintf(`{%q:{"id":"placeholder","url":"/api/files/site_uploads/placeholder/%s"}}`, seedFilename, seedFilename)
	manifestOnly := map[string][]byte{
		"uploads/.manifest.json": []byte(manifestJSON),
		"blocks/hero/config.yaml":        []byte("name: hero\n"),
		"blocks/hero/component.svelte":   []byte("<section />\n"),
		"blocks/hero/fields.yaml":        []byte("[]\n"),
		"blocks/hero/content.yaml":       []byte("{}\n"),
		"page-types/default/config.yaml": []byte("name: Default\nallowed_blocks:\n  - hero\n"),
		"page-types/default/fields.yaml": []byte("[]\n"),
		"page-types/default/layout.yaml": []byte("{}\n"),
		"pages/index.yaml":               []byte("name: Home\npage_type: Default\nsections: []\n"),
		"site/fields.yaml":               []byte("[]\n"),
		"site/content.yaml":              []byte("{}\n"),
	}
	result, err := processImport(app, site, zipFilesBinary(t, manifestOnly), false)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}

	var orphanFound bool
	for _, w := range result.Warnings {
		if w.Kind == "orphan_upload" && w.Path == seedFilename {
			orphanFound = true
			break
		}
	}
	if !orphanFound {
		t.Fatalf("expected orphan_upload warning for %s, got %#v", seedFilename, result.Warnings)
	}

	uploadsAfter, err := app.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch uploads after orphan push: %v", err)
	}
	if len(uploadsAfter) != 1 {
		t.Fatalf("orphan push must not delete records: have %d (expected 1)", len(uploadsAfter))
	}
	// Also verify the disk file actually exists from the seed push — otherwise
	// the "no-delete" guarantee is hollow because there was never a file.
	rec := uploadsAfter[0]
	diskPath := app.DataDir() + "/storage/" + rec.Collection().Id + "/" + rec.Id + "/" + rec.GetString("file")
	if _, err := os.Stat(diskPath); err != nil {
		t.Fatalf("seed upload missing on disk: %s err=%v", diskPath, err)
	}
}

func readZipFileBytes(t *testing.T, zipData []byte, name string) []byte {
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
		return data
	}
	t.Fatalf("missing zip entry %s", name)
	return nil
}

// TestImportLayoutBodySectionsRoundTrip verifies that layout.yaml header/body/footer
// sections import into page_type_sections with the right zones, that a body block
// outside allowed_blocks is accepted without warning (seed-only, by design), and
// that the layout round-trips back out through export with body preserved.
func TestImportLayoutBodySectionsRoundTrip(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	files := map[string]string{
		"blocks/site-header/config.yaml":      "name: site-header\n",
		"blocks/site-header/component.svelte": "<header>hi</header>\n",
		"blocks/site-header/fields.yaml":      "[]\n",
		"blocks/site-header/content.yaml":     "{}\n",
		"blocks/site-footer/config.yaml":      "name: site-footer\n",
		"blocks/site-footer/component.svelte": "<footer>bye</footer>\n",
		"blocks/site-footer/fields.yaml":      "[]\n",
		"blocks/site-footer/content.yaml":     "{}\n",
		// hero carries a field so we can assert body content survives the round-trip
		"blocks/hero/config.yaml":      "name: hero\n",
		"blocks/hero/component.svelte": "<section>{heading}</section>\n",
		"blocks/hero/fields.yaml": "" +
			"- name: heading\n" +
			"  label: Heading\n" +
			"  type: text\n",
		"blocks/hero/content.yaml": "{}\n",
		// cta is intentionally NOT in allowed_blocks — a one-off body seed block.
		"blocks/cta/config.yaml":      "name: cta\n",
		"blocks/cta/component.svelte": "<div>cta</div>\n",
		"blocks/cta/fields.yaml":      "[]\n",
		"blocks/cta/content.yaml":     "{}\n",
		// allowed_blocks lists only hero (dynamic type); cta is omitted on purpose.
		"page-types/default/config.yaml": "name: Default\nallowed_blocks:\n  - hero\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "" +
			"header:\n" +
			"  - block: site-header\n" +
			"body:\n" +
			"  - block: hero\n" +
			"    content:\n" +
			"      heading: Welcome\n" +
			"  - block: cta\n" +
			"footer:\n" +
			"  - block: site-footer\n",
		"pages/index.yaml":  "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":  "[]\n",
		"site/content.yaml": "{}\n",
	}

	result, err := processImport(app, site, zipFiles(t, files), false)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	// cta is outside allowed_blocks but IS a registered symbol, so no warning.
	if len(result.Warnings) > 0 {
		t.Fatalf("expected no import warnings, got %#v", result.Warnings)
	}

	// Resolve the page type, then assert the imported section zones.
	pageTypes, err := app.FindRecordsByFilter("page_types", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil || len(pageTypes) != 1 {
		t.Fatalf("fetch page type: %v (%d found)", err, len(pageTypes))
	}
	sections, err := app.FindRecordsByFilter("page_type_sections", "page_type = {:pt}", "+zone,+index", 0, 0, map[string]any{"pt": pageTypes[0].Id})
	if err != nil {
		t.Fatalf("fetch page type sections: %v", err)
	}
	zoneCounts := map[string]int{}
	for _, s := range sections {
		zoneCounts[s.GetString("zone")]++
	}
	if zoneCounts["header"] != 1 || zoneCounts["body"] != 2 || zoneCounts["footer"] != 1 {
		t.Fatalf("unexpected zone counts: %#v", zoneCounts)
	}

	// Round-trip: export and confirm body survives with its content.
	exportedZip, err := exportSiteToZip(app, site)
	if err != nil {
		t.Fatalf("export site: %v", err)
	}
	layoutYAML := readZipFile(t, exportedZip, "page-types/default/layout.yaml")
	var layout struct {
		Header []struct {
			Block string `yaml:"block"`
		} `yaml:"header"`
		Body []struct {
			Block   string         `yaml:"block"`
			Content map[string]any `yaml:"content"`
		} `yaml:"body"`
		Footer []struct {
			Block string `yaml:"block"`
		} `yaml:"footer"`
	}
	if err := yaml.Unmarshal([]byte(layoutYAML), &layout); err != nil {
		t.Fatalf("parse exported layout: %v\n%s", err, layoutYAML)
	}
	if len(layout.Header) != 1 || len(layout.Body) != 2 || len(layout.Footer) != 1 {
		t.Fatalf("unexpected exported layout shape: %#v\n%s", layout, layoutYAML)
	}
	if layout.Body[0].Block != "hero" || layout.Body[1].Block != "cta" {
		t.Fatalf("body section order/blocks wrong: %#v\n%s", layout.Body, layoutYAML)
	}
	if got := layout.Body[0].Content["heading"]; got != "Welcome" {
		t.Fatalf("body content did not survive round-trip, got %#v\n%s", got, layoutYAML)
	}

	// Importing body must not have created any pages or page sections.
	pageSections, err := app.FindRecordsByFilter("page_sections", "page.site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if err != nil {
		t.Fatalf("fetch page sections: %v", err)
	}
	if len(pageSections) != 0 {
		t.Fatalf("import seeded page sections from layout body, expected none, got %d", len(pageSections))
	}
}

// TestImportLayoutBodyMissingSymbolWarns verifies that a body block referencing an
// unregistered symbol (no blocks/<name>/) produces a missing_symbol warning, unlike
// the allowed_blocks case which is silent.
func TestImportLayoutBodyMissingSymbolWarns(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	site := createImportTestSite(t, app)

	files := map[string]string{
		"page-types/default/config.yaml": "name: Default\n",
		"page-types/default/fields.yaml": "[]\n",
		"page-types/default/layout.yaml": "" +
			"body:\n" +
			"  - block: ghost\n",
		"pages/index.yaml":  "name: Home\npage_type: Default\nsections: []\n",
		"site/fields.yaml":  "[]\n",
		"site/content.yaml": "{}\n",
	}

	result, err := processImport(app, site, zipFiles(t, files), false)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	found := false
	for _, w := range result.Warnings {
		if w.Kind == "missing_symbol" && strings.HasPrefix(w.Path, "body[") {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected a missing_symbol warning for body block, got %#v", result.Warnings)
	}
}
