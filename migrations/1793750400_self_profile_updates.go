package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		// Request hooks limit self-service to name/avatar. Account management
		// and privilege changes retain their separate developer-only boundary.
		users.UpdateRule = types.Pointer("@request.auth.serverRole = 'developer' || id = @request.auth.id")
		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		users.UpdateRule = types.Pointer("@request.auth.serverRole = 'developer'")
		return app.Save(users)
	})
}
