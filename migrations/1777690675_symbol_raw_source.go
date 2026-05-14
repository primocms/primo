package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// component.svelte was being parsed into html/css/js columns on import and
// reconstructed from those columns on export with hardcoded whitespace, so
// any file the user wrote that didn't match the canonical reformat would
// round-trip differently and the file watcher would treat it as a remote
// change — silently overwriting the local edit. Storing the raw bytes
// alongside the parsed columns lets export return exactly what was imported,
// making the round-trip lossless. Existing rows have raw_source empty and
// fall back to the reconstruction path until they're re-imported.
func init() {
	collections := []string{
		"library_symbols",
		"site_symbols",
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
