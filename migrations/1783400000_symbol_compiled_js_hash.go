package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// The publish compiler recompiles every symbol's client bundle on every
// publish, even when the symbol's source is unchanged. Storing a hash of the
// compile input alongside compiled_js lets the compiler skip the esbuild +
// svelte pass (and the re-upload) when nothing about the symbol changed.
// Existing rows have compiled_js_hash empty and are recompiled once, which
// populates the hash; subsequent no-op publishes then skip them.
func init() {
	m.Register(
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("site_symbols")
			if err != nil {
				return err
			}

			if collection.Fields.GetByName("compiled_js_hash") != nil {
				return nil
			}

			collection.Fields.Add(&core.TextField{
				Name: "compiled_js_hash",
				Max:  100,
			})

			return app.Save(collection)
		},
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("site_symbols")
			if err != nil {
				return err
			}

			field := collection.Fields.GetByName("compiled_js_hash")
			if field == nil {
				return nil
			}

			collection.Fields.RemoveById(field.GetId())
			return app.Save(collection)
		},
	)
}
