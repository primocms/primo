package internal

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func TestCloneEntryReferencesSharedFields(t *testing.T) {
	app := newImportTestApp(t)
	t.Cleanup(func() { app.ResetBootstrapState() })
	site := createImportTestSite(t, app)
	fields, err := app.FindCollectionByNameOrId("site_fields")
	if err != nil {
		t.Fatal(err)
	}
	entries, err := app.FindCollectionByNameOrId("site_entries")
	if err != nil {
		t.Fatal(err)
	}
	for _, fieldType := range []string{"image", "link", "page", "text"} {
		t.Run(fieldType, func(t *testing.T) {
			field := core.NewRecord(fields)
			field.Set("site", site.Id)
			field.Set("key", fieldType)
			field.Set("label", fieldType)
			field.Set("type", fieldType)
			if err := app.Save(field); err != nil {
				t.Fatal(err)
			}
			ids := IDMap{}
			for i := 0; i < 5; i++ {
				entry := core.NewRecord(entries)
				entry.Set("field", field.Id)
				entry.Set("locale", "en")
				switch fieldType {
				case "image":
					entry.Set("value", map[string]any{"upload": "old-upload", "alt": "Photo"})
				case "link":
					entry.Set("value", map[string]any{"page": "old-page", "label": "About"})
				default:
					entry.Set("value", "old-page")
				}
				if err := app.Save(entry); err != nil {
					t.Fatal(err)
				}
				ids[entry.Id] = entry.Id
			}
			updateEntryValueReferences(app, "site_entries", IDMap{}, IDMap{"old-page": "new-page"}, IDMap{"old-upload": "new-upload"}, ids)
			for _, id := range ids {
				entry, err := app.FindRecordById("site_entries", id)
				if err != nil {
					t.Fatal(err)
				}
				switch fieldType {
				case "image", "link":
					var value map[string]any
					if err := entry.UnmarshalJSONField("value", &value); err != nil {
						t.Fatal(err)
					}
					key, want := "upload", "new-upload"
					if fieldType == "link" {
						key, want = "page", "new-page"
					}
					if value[key] != want {
						t.Fatalf("got %v, want %s", value, want)
					}
				default:
					var value string
					if err := entry.UnmarshalJSONField("value", &value); err != nil {
						t.Fatal(err)
					}
					want := "old-page"
					if fieldType == "page" {
						want = "new-page"
					}
					if value != want {
						t.Fatalf("got %s, want %s", value, want)
					}
				}
			}
		})
	}
}
