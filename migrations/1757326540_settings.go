package migrations

import (
	"os"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			settings := app.Settings()
			appURL := os.Getenv("PRIMO_APP_URL")
			if appURL != "" {
				settings.Meta.AppURL = appURL
			}

			settings.Meta.AppName = "Primo CMS"
			app.Save(settings)

			superuserEmail := os.Getenv("PRIMO_SUPERUSER_EMAIL")
			superuserPassword := os.Getenv("PRIMO_SUPERUSER_PASSWORD")
			if superuserEmail != "" && superuserPassword != "" {
				collection, err := app.FindCollectionByNameOrId("_superusers")
				if err != nil {
					return err
				}

				record := core.NewRecord(collection)
				record.Set("email", superuserEmail)
				record.Set("password", superuserPassword)
				app.Save(record)
			}

			userEmail := os.Getenv("PRIMO_USER_EMAIL")
			userPassword := os.Getenv("PRIMO_USER_PASSWORD")
			if userEmail != "" && userPassword != "" {
				collection, err := app.FindCollectionByNameOrId("users")
				if err != nil {
					return err
				}

				record := core.NewRecord(collection)
				record.Set("email", userEmail)
				record.Set("password", userPassword)
				record.Set("name", "Primo Admin")
				record.Set("serverRole", "developer")
				record.SetVerified(true)
				app.Save(record)
			}

			return nil
		},
		func(app core.App) error {
			return nil
		},

		// Use old filename to ensure that the migration will not be redone on existing installations.
		"1754640604_settings.js",
	)
}
