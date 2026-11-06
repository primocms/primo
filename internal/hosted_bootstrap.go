package internal

import (
	"errors"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Automated customer apps must fail before listening if first-boot account
// creation is incomplete. Manual deployments retain their existing setup flow.
func checkManagedBootstrap(app core.App) error {
	if ownerOnly(app) {
		owner, err := app.FindRecordById("users", hostedOwnerID(app))
		if err != nil || owner.GetString("serverRole") != "developer" || !owner.Verified() {
			return errors.New("managed bootstrap incomplete: owner-only account missing")
		}
	}
	admins, err := app.CountRecords("_superusers", dbx.Not(dbx.HashExp{"email": "__pbinstaller@example.com"}))
	if err != nil {
		return err
	}
	users, err := app.CountRecords("users", dbx.HashExp{"serverRole": "developer", "verified": true})
	if err != nil {
		return err
	}
	if admins < 1 || users < 1 {
		return errors.New("managed bootstrap incomplete: refusing public setup")
	}
	return nil
}
