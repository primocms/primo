package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// The publish compiler re-renders every page on every publish, even when
// nothing that affects a page's HTML changed. Storing a hash of the page's
// effective input (its content + the hashes of the symbols/layout it depends
// on) alongside compiled_html lets the compiler skip the server-side render
// and re-upload for unchanged pages. Existing rows have compiled_html_hash
// empty and are re-rendered once, which populates the hash; subsequent no-op
// publishes then skip them. See 1783400000_symbol_compiled_js_hash.go for the
// symbol-level counterpart whose hashes this folds in.
func init() {
	m.Register(
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("pages")
			if err != nil {
				return err
			}

			if collection.Fields.GetByName("compiled_html_hash") != nil {
				return nil
			}

			collection.Fields.Add(&core.TextField{
				Name: "compiled_html_hash",
				Max:  100,
			})

			return app.Save(collection)
		},
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("pages")
			if err != nil {
				return err
			}

			field := collection.Fields.GetByName("compiled_html_hash")
			if field == nil {
				return nil
			}

			collection.Fields.RemoveById(field.GetId())
			return app.Save(collection)
		},
	)
}
