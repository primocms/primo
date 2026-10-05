package internal

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"
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
	refs, valid := uploadImportRefs(uploads, []byte(`{
		"other.png":{"id":"current-id","hash":"hash-other"},
		"old-name.png":{"id":"foreign-id","hash":"hash-current"}
	}`))
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
	}, []byte(`{"a.png":{"id":"ambiguous-id"},"b.png":{"id":"ambiguous-id"}}`))
	if refs["ambiguous-id"] != "" {
		t.Fatalf("ambiguous upload must not resolve: %#v", refs)
	}
}
