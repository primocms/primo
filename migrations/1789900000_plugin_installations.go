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
		// Same locking posture as primo_forms/primo_form_submissions: no
		// list/view/create/update/delete rules, so this collection is
		// reachable only through the scoped plugin install/uninstall routes
		// (internal/plugin_installations.go), never through the generic
		// PocketBase collection API.
		installations := core.NewBaseCollection("primo_plugin_installations")
		installations.Fields.Add(
			&core.RelationField{Name: "site", CollectionId: sites.Id, Required: true, CascadeDelete: true},
			&core.TextField{Name: "plugin", Required: true, Max: 64},
			&core.JSONField{Name: "capabilities", Required: true, MaxSize: 2048},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		installations.AddIndex("idx_primo_plugin_installations_site_plugin", true, "site, plugin", "")
		if err := app.Save(installations); err != nil {
			return err
		}

		// Backfill: a site that already registered a form before plugin
		// installation existed keeps working exactly as before — data and
		// email, matching the prior implicit behavior where any
		// authenticated site admin could set notifyTo and SMTP (if
		// configured) would just send. This is a data migration scoped to
		// sites that actually used the forms plugin; it must not touch
		// primo_forms or primo_form_submissions, and must not grant
		// anything to a site that never registered a form.
		existingForms, err := app.FindAllRecords("primo_forms")
		if err != nil {
			return err
		}
		seen := map[string]bool{}
		for _, form := range existingForms {
			siteId := form.GetString("site")
			if siteId == "" || seen[siteId] {
				continue
			}
			seen[siteId] = true
			record := core.NewRecord(installations)
			record.Set("site", siteId)
			record.Set("plugin", "forms")
			record.Set("capabilities", []string{"data", "email"})
			if err := app.Save(record); err != nil {
				return err
			}
		}
		return nil
	}, func(app core.App) error {
		// Removing this silently revokes every site's granted plugin
		// capabilities. Require an explicit, reviewed decision instead of a
		// blind rollback — same posture as the forms migration this extends.
		return fmt.Errorf("plugin_installations rollback requires an explicit review of what capabilities each site currently relies on")
	})
}
