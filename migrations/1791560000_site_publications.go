package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		sites, err := app.FindCollectionByNameOrId("sites")
		if err != nil {
			return err
		}
		collection := core.NewCollection("base", "site_publications")
		// Internal publication state is only accessible through site-authorized routes.
		collection.Fields.Add(
			&core.RelationField{Name: "site", CollectionId: sites.Id, Required: true, CascadeDelete: true},
			&core.TextField{Name: "published_revision"},
			&core.TextField{Name: "published_at"},
			&core.TextField{Name: "prefix"},
			&core.TextField{Name: "previous_prefix"},
			&core.TextField{Name: "attempt_id"},
			&core.TextField{Name: "attempt_revision"},
			&core.TextField{Name: "attempt_state"},
			&core.TextField{Name: "attempt_started_at"},
			&core.TextField{Name: "attempt_finished_at"},
			&core.TextField{Name: "attempt_error", Max: 4000},
		)
		collection.Indexes = []string{"CREATE UNIQUE INDEX idx_site_publications_site ON site_publications (site)"}
		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("site_publications")
		if err != nil {
			return err
		}
		return app.Delete(collection)
	})
}
