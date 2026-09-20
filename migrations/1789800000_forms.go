package migrations

import (
	"fmt"
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		sites, err := app.FindCollectionByNameOrId("sites")
		if err != nil {
			return err
		}
		// All direct collection APIs are locked. Only the scoped forms routes write/read these.
		forms := core.NewBaseCollection("primo_forms")
		forms.Fields.Add(
			&core.RelationField{Name: "site", CollectionId: sites.Id, Required: true, CascadeDelete: true},
			&core.TextField{Name: "slug", Required: true, Max: 64},
			&core.JSONField{Name: "definition", Required: true, MaxSize: 32768},
		)
		forms.AddIndex("idx_primo_forms_site_slug", true, "site, slug", "")
		if err := app.Save(forms); err != nil {
			return err
		}
		submissions := core.NewBaseCollection("primo_form_submissions")
		submissions.Fields.Add(
			&core.RelationField{Name: "form", CollectionId: forms.Id, Required: true, CascadeDelete: true},
			&core.TextField{Name: "request_key", Required: true, Max: 80},
			&core.JSONField{Name: "data", Required: true, MaxSize: 32768},
			&core.EmailField{Name: "notify_to"},
			&core.TextField{Name: "notification", Max: 20},
			&core.NumberField{Name: "attempts", OnlyInt: true},
			&core.DateField{Name: "next_attempt"},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		submissions.AddIndex("idx_primo_form_request", true, "form, request_key", "")
		submissions.AddIndex("idx_primo_form_jobs", false, "notification, next_attempt", "")
		if err := app.Save(submissions); err != nil {
			return err
		}
		settings := app.Settings()
		settings.RateLimits.Rules = append([]core.RateLimitRule{{Label: "/api/primo/forms/", MaxRequests: 10, Duration: 60}}, settings.RateLimits.Rules...)
		return app.Save(settings)
	}, func(app core.App) error {
		// Removing the feature must not silently erase collected submissions.
		return fmt.Errorf("forms rollback requires an explicit export and removal of primo_form_submissions and primo_forms")
	})
}
