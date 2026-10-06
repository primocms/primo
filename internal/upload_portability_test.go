package internal

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestImportUploadsAcrossDatabasesRepairsForeignIDs(t *testing.T) {
	local := newImportTestApp(t)
	defer local.ResetBootstrapState()
	localSite := createImportTestSite(t, local)
	files := reproSiteFiles("hero.png", fakePNG())
	files["site/fields.yaml"] = []byte("- name: favicon\n  type: image\n- name: og_default\n  type: image\n")
	files["site/content.yaml"] = []byte("favicon:\n  upload: uploads/hero.png\nog_default:\n  upload: uploads/hero.png\n")
	if _, err := processImport(local, localSite, zipFilesBinary(t, files), false); err != nil {
		t.Fatal(err)
	}
	exported, err := exportSiteToZip(local, localSite)
	if err != nil {
		t.Fatal(err)
	}
	// A pull/dev export embeds local record IDs and the manifest mapping.
	reader, err := zip.NewReader(bytes.NewReader(exported), int64(len(exported)))
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range reader.File {
		r, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		files[f.Name], err = io.ReadAll(r)
		r.Close()
		if err != nil {
			t.Fatal(err)
		}
	}
	delete(files, "uploads/hero.png")
	var manifest map[string]struct{ ID, Hash string }
	if err := json.Unmarshal(files["uploads/.manifest.json"], &manifest); err != nil {
		t.Fatal(err)
	}
	var foreignID string
	for _, entry := range manifest {
		foreignID = entry.ID
	}
	if !strings.Contains(string(files["pages/index.yaml"]), foreignID) {
		t.Fatal("fixture export does not contain the foreign upload ID")
	}

	for _, staleNames := range []bool{false, true} {
		t.Run(map[bool]string{false: "exported names", true: "stale manifest names"}[staleNames], func(t *testing.T) {
			hosted := newImportTestApp(t)
			defer hosted.ResetBootstrapState()
			hostedSite := createImportTestSite(t, hosted)
			pushFiles := make(map[string][]byte, len(files))
			for name, data := range files {
				if staleNames && strings.HasPrefix(name, "uploads/") && name != "uploads/.manifest.json" {
					name = "uploads/renamed-again.png"
				}
				pushFiles[name] = data
			}
			result, err := processImport(hosted, hostedSite, zipFilesBinary(t, pushFiles), false)
			if err != nil {
				t.Fatal(err)
			}
			for _, warning := range result.Warnings {
				if warning.Kind == "unresolved_upload" || warning.Kind == "orphan_upload" {
					t.Fatalf("unexpected upload warning: %#v", warning)
				}
			}
			uploads, err := hosted.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, map[string]any{"site": hostedSite.Id})
			if err != nil || len(uploads) != 1 {
				t.Fatalf("expected one hosted upload: %v %d", err, len(uploads))
			}
			id := uploads[0].Id
			if id == foreignID {
				t.Fatal("fixture must use different database IDs")
			}
			for _, collection := range []string{"page_section_entries", "site_entries"} {
				entries, err := hosted.FindAllRecords(collection)
				if err != nil {
					t.Fatal(err)
				}
				found := 0
				for _, entry := range entries {
					value := entry.GetString("value")
					if strings.Contains(value, foreignID) {
						t.Fatalf("foreign ID persisted in %s: %s", collection, value)
					}
					if strings.Contains(value, id) {
						found++
					}
				}
				if found == 0 {
					t.Fatalf("no repaired images in %s", collection)
				}
			}
			// The same old local export can be pushed again without duplicating
			// images or reverting its repaired references to the foreign ID.
			if _, err := processImport(hosted, hostedSite, zipFilesBinary(t, pushFiles), false); err != nil {
				t.Fatal(err)
			}
			after, _ := hosted.FindAllRecords("site_uploads")
			if len(after) != 1 {
				t.Fatalf("repeat push created %d uploads", len(after))
			}
		})
	}
}

func TestUploadReferenceRepairPreservesValidIDsAndWarnsOnUnknowns(t *testing.T) {
	uploads := map[string]uploadReconcileEntry{
		"current.png": {ID: "current-id", Hash: "hash-current"},
		"other.png":   {ID: "other-id", Hash: "hash-other"},
	}
	refs, valid := uploadImportRefs(uploads, map[string][]byte{"uploads/.manifest.json": []byte(`{
		"other.png":{"id":"current-id","hash":"hash-other"},
		"old-name.png":{"id":"foreign-id","hash":"hash-current"}
	}`)})
	value := map[string]interface{}{"images": []interface{}{
		map[string]interface{}{"upload": "current-id"},
		map[string]interface{}{"upload": "foreign-id"},
		map[string]interface{}{"upload": "unknown-id"},
		map[string]interface{}{"upload": ""},
	}}
	var warnings []ImportWarning
	rewriteUploadRefs(value, refs, valid, "pages/index.yaml", "", &warnings)
	images := value["images"].([]interface{})
	for i, expected := range []string{"current-id", "current-id", "unknown-id", ""} {
		if got := images[i].(map[string]interface{})["upload"]; got != expected {
			t.Fatalf("image %d: %v != %s", i, got, expected)
		}
	}
	if len(warnings) != 1 || warnings[0].Kind != "unresolved_upload" || warnings[0].Path != "images[2].upload" {
		t.Fatalf("unexpected warnings: %#v", warnings)
	}
}

func TestImportUnknownUploadWarnsWithoutGuessing(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := reproSiteFiles("hero.png", fakePNG())
	files["pages/index.yaml"] = bytes.ReplaceAll(files["pages/index.yaml"], []byte("uploads/hero.png"), []byte("unknownforeign1"))
	result, err := processImport(app, site, zipFilesBinary(t, files), false)
	if err != nil {
		t.Fatal(err)
	}
	for _, warning := range result.Warnings {
		if warning.Kind == "unresolved_upload" && warning.File == "pages/index.yaml" {
			return
		}
	}
	t.Fatalf("missing unresolved upload warning: %#v", result.Warnings)
}

func TestUploadReferenceRepairRejectsAmbiguousManifest(t *testing.T) {
	refs, _ := uploadImportRefs(map[string]uploadReconcileEntry{
		"a.png": {ID: "first-id"}, "b.png": {ID: "second-id"},
	}, map[string][]byte{
		"uploads/.manifest.json": []byte(`{"a.png":{"id":"ambiguous-id"},"b.png":{"id":"ambiguous-id"}}`),
		"uploads/a.png":          {}, "uploads/b.png": {},
	})
	if refs["ambiguous-id"] != "" {
		t.Fatalf("ambiguous upload must not resolve: %#v", refs)
	}
}

// TestImportUploadFormats repairs both page and block/site content in each
// supported format, including JSON keys that do not contain a literal upload.
func TestImportUploadFormats(t *testing.T) {
	for _, format := range []string{"yaml", "yml", "json", "escaped-json"} {
		t.Run(format, func(t *testing.T) {
			app := newImportTestApp(t)
			defer app.ResetBootstrapState()
			site := createImportTestSite(t, app)
			files := reproSiteFiles("hero.png", fakePNG())
			files["blocks/hero/content.yaml"] = []byte("image:\n  upload: foreignupload01\n")
			files["site/fields.yaml"] = []byte("- name: favicon\n  type: image\n")
			files["site/content.yaml"] = []byte("favicon:\n  upload: foreignupload01\n")
			files["pages/index.yaml"] = bytes.ReplaceAll(files["pages/index.yaml"], []byte("uploads/hero.png"), []byte("foreignupload01"))
			files["uploads/.manifest.json"] = []byte(`{"hero.png":{"id":"foreignupload01"}}`)
			if format == "yml" {
				files["pages/index.yml"] = files["pages/index.yaml"]
				delete(files, "pages/index.yaml")
			} else if strings.Contains(format, "json") {
				for _, name := range []string{"pages/index.yaml", "blocks/hero/content.yaml", "site/content.yaml"} {
					var value interface{}
					if err := yaml.Unmarshal(files[name], &value); err != nil {
						t.Fatal(err)
					}
					data, err := json.Marshal(value)
					if err != nil {
						t.Fatal(err)
					}
					if format == "escaped-json" {
						data = bytes.ReplaceAll(data, []byte(`"upload"`), []byte(`"\u0075pload"`))
					}
					files[strings.TrimSuffix(name, ".yaml")+".json"] = data
					delete(files, name)
				}
			}
			result, err := processImport(app, site, zipFilesBinary(t, files), false)
			if err != nil {
				t.Fatal(err)
			}
			for _, warning := range result.Warnings {
				if warning.Kind == "unresolved_upload" {
					t.Fatalf("resolvable upload warned: %#v", warning)
				}
			}
			uploads, err := app.FindAllRecords("site_uploads")
			if err != nil || len(uploads) != 1 {
				t.Fatalf("expected one image: %v, %d", err, len(uploads))
			}
			for _, collection := range []string{"page_section_entries", "site_symbol_entries", "site_entries"} {
				entries, err := app.FindAllRecords(collection)
				if err != nil || len(entries) == 0 {
					t.Fatalf("missing %s image entries: %v", collection, err)
				}
				for _, entry := range entries {
					if !strings.Contains(entry.GetString("value"), uploads[0].Id) {
						t.Fatalf("%s image was not repaired: %s", collection, entry.GetString("value"))
					}
				}
			}
		})
	}
}

// TestUploadRewritePreservesUnchangedBytes keeps authored YAML and JSON intact
// while still warning on unknown IDs; replacement also preserves JSON integers.
func TestUploadRewritePreservesUnchangedBytes(t *testing.T) {
	for _, extension := range []string{"yaml", "yml", "json"} {
		for _, id := range []string{"valid-id", "unknown-id"} {
			raw := []byte("# authored comment\nimage: { upload: " + id + ", alt: 'Keep me' }\n")
			if extension == "json" {
				raw = []byte(`{ "image" : {"upload": "` + id + `", "alt": "Keep me"} }`)
			}
			var warnings []ImportWarning
			out, err := rewriteUploadFile(raw, "pages/index."+extension, nil, map[string]bool{"valid-id": true}, &warnings)
			if err != nil || !bytes.Equal(out, raw) {
				t.Fatalf("unchanged %s was re-encoded: %v, %s", extension, err, out)
			}
			if (id == "unknown-id") != (len(warnings) == 1) {
				t.Fatalf("unexpected warnings: %#v", warnings)
			}
		}
	}
	var warnings []ImportWarning
	out, err := rewriteUploadFile([]byte(`{"image":{"\u0075pload":"foreign-id"},"large":9007199254740993}`), "pages/index.json", map[string]string{"foreign-id": "target-id"}, nil, &warnings)
	if err != nil || !bytes.Contains(out, []byte("9007199254740993")) || !bytes.Contains(out, []byte("target-id")) {
		t.Fatalf("JSON replacement failed or lost numeric precision: %v, %s", err, out)
	}
}

// TestImportValidUploadNoOpPreservesClientEdit ensures an unchanged page with
// custom YAML formatting takes the raw_source guard and retains a CMS edit.
func TestImportValidUploadNoOpPreservesClientEdit(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	files := reproSiteFiles("hero.png", fakePNG())
	if _, err := processImport(app, site, zipFilesBinary(t, files), false); err != nil {
		t.Fatal(err)
	}
	uploads, _ := app.FindAllRecords("site_uploads")
	raw := append([]byte("# Keep this authored comment\n"), bytes.ReplaceAll(files["pages/index.yaml"], []byte("uploads/hero.png"), []byte(uploads[0].Id))...)
	files["pages/index.yaml"] = raw
	if _, err := processImport(app, site, zipFilesBinary(t, files), false); err != nil {
		t.Fatal(err)
	}
	pages, _ := app.FindAllRecords("pages")
	if pages[0].GetString("raw_source") != string(raw) {
		t.Fatal("import changed authored YAML without replacing a reference")
	}
	entries, _ := app.FindAllRecords("page_section_entries")
	entry := entries[0]
	entry.Set("value", map[string]interface{}{"upload": uploads[0].Id, "alt": "Client edit"})
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	if _, err := processImport(app, site, zipFilesBinary(t, files), false); err != nil {
		t.Fatal(err)
	}
	reloaded, err := app.FindRecordById("page_section_entries", entry.Id)
	if err != nil || !strings.Contains(reloaded.GetString("value"), "Client edit") {
		t.Fatalf("unchanged import overwrote the client image edit: %v", err)
	}
}

// TestImportStaleManifestFilenameCollision distinguishes a renamed source
// image from an unrelated destination upload occupying the old filename.
func TestImportStaleManifestFilenameCollision(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	site := createImportTestSite(t, app)
	red := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="red"/></svg>`)
	blue := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="blue"/></svg>`)
	if _, err := processImport(app, site, zipFilesBinary(t, reproSiteFiles("existing.svg", red)), false); err != nil {
		t.Fatal(err)
	}
	existing, _ := app.FindAllRecords("site_uploads")
	files := reproSiteFiles("renamed.svg", blue)
	files["pages/index.yaml"] = bytes.ReplaceAll(files["pages/index.yaml"], []byte("uploads/renamed.svg"), []byte("foreignupload01"))
	files["uploads/.manifest.json"] = []byte(fmt.Sprintf(`{%q:{"id":"foreignupload01","hash":"%x"}}`, existing[0].GetString("file"), sha256.Sum256(blue)))
	if _, err := processImport(app, site, zipFilesBinary(t, files), false); err != nil {
		t.Fatal(err)
	}
	entries, _ := app.FindAllRecords("page_section_entries")
	if len(entries) != 1 || strings.Contains(entries[0].GetString("value"), existing[0].Id) || strings.Contains(entries[0].GetString("value"), "foreignupload01") {
		t.Fatal("stale manifest selected the unrelated destination image")
	}
}

// TestUploadManifestFilenameNeedsIdentity rejects unverified destination-only
// names, but accepts a supplied file even if its bytes were intentionally edited.
func TestUploadManifestFilenameNeedsIdentity(t *testing.T) {
	uploads := map[string]uploadReconcileEntry{"image.png": {ID: "target-id", Hash: "new-hash"}}
	files := map[string][]byte{"uploads/.manifest.json": []byte(`{"image.png":{"id":"foreign-id","hash":"old-hash"}}`)}
	refs, _ := uploadImportRefs(uploads, files)
	if refs["foreign-id"] != "" {
		t.Fatal("unrelated destination filename was trusted")
	}
	files["uploads/image.png"] = []byte("edited bytes")
	refs, _ = uploadImportRefs(uploads, files)
	if refs["foreign-id"] != "target-id" {
		t.Fatal("the supplied file's identity was not accepted")
	}
}
