package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Blocks and page types are addressed by their folder name in the file format
// (blocks/<folder>/, page-types/<folder>/, allowed_blocks, `block:` and
// `page_type:` references), but only the display name was stored, and export
// rebuilt the folder from it. Renaming a block's label, or any name whose
// slug differs from its folder ("Hours & CTA Strip" in blocks/hours-cta/),
// renamed the folder on the next pull. Store the folder the record was
// imported from so export can reproduce it. Existing rows stay empty and fall
// back to the name-derived folder until their next import.
func init() {
	collections := []string{"site_symbols", "page_types"}
	m.Register(
		func(app core.App) error {
			for _, name := range collections {
				collection, err := app.FindCollectionByNameOrId(name)
				if err != nil {
					return err
				}
				if collection.Fields.GetByName("folder") != nil {
					continue
				}
				collection.Fields.Add(&core.TextField{Name: "folder", Max: 200})
				if err := app.Save(collection); err != nil {
					return err
				}
			}
			return nil
		},
		func(app core.App) error {
			for _, name := range collections {
				collection, err := app.FindCollectionByNameOrId(name)
				if err != nil {
					return err
				}
				field := collection.Fields.GetByName("folder")
				if field == nil {
					continue
				}
				collection.Fields.RemoveById(field.GetId())
				if err := app.Save(collection); err != nil {
					return err
				}
			}
			return nil
		},
	)
}
