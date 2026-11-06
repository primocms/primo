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
		users.CreateRule = types.Pointer("@request.auth.serverRole = 'developer'")
		users.UpdateRule = types.Pointer("@request.auth.serverRole = 'developer'")
		users.ManageRule = types.Pointer("@request.auth.serverRole = 'developer'")
		users.DeleteRule = types.Pointer("@request.auth.serverRole = 'developer' || id = @request.auth.id")
		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		users.CreateRule = types.Pointer("@request.auth.serverRole != ''")
		users.UpdateRule = types.Pointer("@request.auth.serverRole != ''")
		users.ManageRule = types.Pointer("@request.auth.serverRole != ''")
		users.DeleteRule = types.Pointer("@request.auth.serverRole != '' || id = @request.auth.id")
		return app.Save(users)
	})
}
