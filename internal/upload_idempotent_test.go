package internal

import (
	"strings"
	"testing"
)

// reproSiteFiles returns a minimal importable site that references a single
// upload via a symbolic `upload: uploads/<name>` path. The upload filename is
// parameterized so we can simulate what the CLI sends on push N (symbolic on
// push 1, canonical on later pushes if the writeback rename worked).
func reproSiteFiles(uploadName string, pngBytes []byte) map[string][]byte {
	return map[string][]byte{
		"uploads/" + uploadName:           pngBytes,
		"blocks/hero/config.yaml":         []byte("name: hero\n"),
		"blocks/hero/component.svelte":    []byte("<section><img src={image.url} alt={image.alt} /></section>\n"),
		"blocks/hero/fields.yaml":         []byte("- name: image\n  label: Image\n  type: image\n"),
		"blocks/hero/content.yaml":        []byte("{}\n"),
		"page-types/default/config.yaml":  []byte("name: Default\nallowed_blocks:\n  - hero\n"),
		"page-types/default/fields.yaml":  []byte("[]\n"),
		"page-types/default/layout.yaml":  []byte("{}\n"),
		"pages/index.yaml": []byte("" +
			"name: Home\n" +
			"page_type: Default\n" +
			"sections:\n" +
			"  - block: hero\n" +
			"    content:\n" +
			"      image:\n" +
			"        url: \"\"\n" +
			"        alt: A hero image\n" +
			"        upload: uploads/" + uploadName + "\n"),
		"site/fields.yaml":  []byte("[]\n"),
		"site/content.yaml": []byte("{}\n"),
	}
}

func canonicalFrom(t *testing.T, res *ImportResult, symbolic string) string {
	t.Helper()
	m, ok := res.CreatedIDs["uploads/.manifest.json"]
	if !ok {
		t.Fatalf("no uploads manifest in created_ids")
	}
	blob, ok := m["_uploads"].(map[string]interface{})
	if !ok {
		t.Fatalf("no _uploads blob: %#v", m)
	}
	entry, ok := blob[symbolic].(map[string]interface{})
	if !ok {
		t.Fatalf("no entry for %q: %#v", symbolic, blob)
	}
	c, _ := entry["canonical"].(string)
	return c
}

// TestUploadRepushWithCanonicalNameIsNoOp models the CORRECT CLI behavior:
// after push 1 renames the local file to its canonical suffixed name, push 2
// sends that canonical name. This should be a pure no-op.
func TestUploadRepushWithCanonicalNameIsNoOp(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	png := fakePNG()

	// Push 1: symbolic name.
	res1, err := processImport(app, site, zipFilesBinary(t, reproSiteFiles("hero.png", png)), false)
	if err != nil {
		t.Fatalf("push 1: %v", err)
	}
	canonical := canonicalFrom(t, res1, "hero.png")
	if !strings.HasPrefix(canonical, "hero_") {
		t.Fatalf("expected canonical hero_xxx.png, got %q", canonical)
	}
	up1, _ := app.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	if len(up1) != 1 {
		t.Fatalf("after push 1 expected 1 upload, got %d", len(up1))
	}

	// Push 2: CLI renamed the local file to `canonical`, so it now sends that.
	// NOTE: the yaml ref would also have been rewritten to the record id, but
	// we keep the symbolic upload key pointing at the canonical filename to
	// isolate the upload-dedup behavior.
	res2, err := processImport(app, site, zipFilesBinary(t, reproSiteFiles(canonical, png)), false)
	if err != nil {
		t.Fatalf("push 2: %v", err)
	}
	up2, _ := app.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
	canonical2 := canonicalFrom(t, res2, canonical)

	if len(up2) != 1 {
		t.Fatalf("REPRO: push 2 with canonical name created duplicate uploads: before=1 after=%d", len(up2))
	}
	if canonical2 != canonical {
		t.Fatalf("REPRO: push 2 re-suffixed the already-canonical name: %q -> %q", canonical, canonical2)
	}
}

// TestUploadRepushWithSymbolicNameIsIdempotent guards the regression: the CLI
// keeps sending the ORIGINAL symbolic name every push (the writeback rename
// never took, or the yaml still resolves to the same on-disk symbolic file).
// Before the content-hash match this stacked a fresh suffix and orphaned a new
// site_uploads record on every push; now each push is a no-op.
func TestUploadRepushWithSymbolicNameIsIdempotent(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	png := fakePNG()

	var lastCanonical string
	for i := 1; i <= 4; i++ {
		res, err := processImport(app, site, zipFilesBinary(t, reproSiteFiles("hero.png", png)), false)
		if err != nil {
			t.Fatalf("push %d: %v", i, err)
		}
		lastCanonical = canonicalFrom(t, res, "hero.png")
		ups, _ := app.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": site.Id})
		t.Logf("push %d: uploads=%d canonical=%q", i, len(ups), lastCanonical)
		if len(ups) != 1 {
			t.Fatalf("REPRO CONFIRMED: after push %d there are %d site_uploads records for one byte-identical image (canonical=%q). Each push re-suffixed and orphaned the prior record.", i, len(ups), lastCanonical)
		}
	}
	// Count underscore-delimited suffix segments after the base name.
	if strings.Count(lastCanonical, "_") > 1 {
		t.Fatalf("REPRO CONFIRMED: canonical name stacked multiple suffixes: %q", lastCanonical)
	}
}
