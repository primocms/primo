package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// A page is exploded across pages + page_sections + page_section_entries on
// import and reconstructed on export, so there's no stored copy of the exact
// bytes the dev pushed. Import therefore re-writes (delete-and-recreate) every
// page's content on every push, even a no-op re-push of identical bytes — which
// is both slow and lets a whole-site push clobber concurrent server edits to
// pages the dev never touched.
//
// Storing the raw incoming page YAML alongside the exploded rows lets import
// compare sha256(incoming) against the stored bytes and skip a page entirely
// when it's unchanged. Mirrors the symbol raw_source field (migration
// 1777690675). Existing rows have raw_source empty and fall back to the normal
// import path until they're re-imported once.
func init() {
	collections := []string{
		"pages",
	}

	m.Register(
		func(app core.App) error {
			for _, name := range collections {
				collection, err := app.FindCollectionByNameOrId(name)
				if err != nil {
					return err
				}

				if collection.Fields.GetByName("raw_source") != nil {
					continue
				}

				collection.Fields.Add(&core.TextField{
					Name: "raw_source",
					Max:  500_000,
				})

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

				field := collection.Fields.GetByName("raw_source")
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
