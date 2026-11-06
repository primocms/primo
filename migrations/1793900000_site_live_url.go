package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Optional address of the live site when it is hosted outside Primo (GitHub
// Pages, Netlify, a plain web server). When set, the sitemap uses it as its
// base URL and Primo serves its own copy with X-Robots-Tag: noindex.
func init() {
	m.Register(
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("sites")
			if err != nil {
				return err
			}
			if collection.Fields.GetByName("live_url") == nil {
				collection.Fields.Add(&core.URLField{Name: "live_url"})
			}
			return app.Save(collection)
		},
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("sites")
			if err != nil {
				return err
			}
			if existing := collection.Fields.GetByName("live_url"); existing != nil {
				collection.Fields.RemoveById(existing.GetId())
			}
			return app.Save(collection)
		},
	)
}
