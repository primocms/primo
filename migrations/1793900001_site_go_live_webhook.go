package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Optional go-live webhook per site (see internal/go_live.go). The secret is
// hidden: the records API never returns it.
func init() {
	fields := []core.Field{
		&core.URLField{Name: "go_live_webhook_url"},
		&core.TextField{Name: "go_live_webhook_secret", Max: 1000, Hidden: true},
	}

	m.Register(
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("sites")
			if err != nil {
				return err
			}
			for _, f := range fields {
				if collection.Fields.GetByName(f.GetName()) == nil {
					collection.Fields.Add(f)
				}
			}
			return app.Save(collection)
		},
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("sites")
			if err != nil {
				return err
			}
			for _, f := range fields {
				if existing := collection.Fields.GetByName(f.GetName()); existing != nil {
					collection.Fields.RemoveById(existing.GetId())
				}
			}
			return app.Save(collection)
		},
	)
}
