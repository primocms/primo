package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Custom-domain connection state for sites. The routing key stays the single
// `host` field; these fields describe how a *custom* host got connected and let
// the editor render DNS records + a status pill across reloads without
// re-hitting the platform (e.g. Railway) on every view. Empty domain_status
// means "no custom-domain flow" — unassigned sites and base-domain subdomains
// never populate these. See internal/domain_provider.go.
func init() {
	fields := []core.Field{
		&core.TextField{Name: "domain_status", Max: 20},
		&core.JSONField{Name: "domain_dns_records", MaxSize: 1 << 16},
		&core.TextField{Name: "domain_provider_id", Max: 255},
		&core.TextField{Name: "domain_error", Max: 500},
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
