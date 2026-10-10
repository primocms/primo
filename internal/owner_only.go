package internal

import (
	"os"
	"strconv"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func ownerOnly(app core.App) bool {
	if record, err := app.FindFirstRecordByData("config_values", "key", "owner_only"); err == nil {
		if value, err := strconv.ParseBool(record.GetString("value")); err == nil {
			return value
		}
	}
	return os.Getenv("PRIMO_OWNER_ONLY") == "true"
}

func hostedOwnerID(app core.App) string {
	if record, err := app.FindFirstRecordByData("config_values", "key", "hosted_owner_id"); err == nil {
		return record.GetString("value")
	}
	return ""
}

// Bootstrap/internal saves still work, but customer API requests cannot create
// another account or grant a collaborator access. Both assignment creation and
// edits are guarded, including developer roles (which aren't editor seats).
func registerOwnerOnly(pb *pocketbase.PocketBase) {
	denied := func() error {
		return apis.NewForbiddenError("Your plan includes only the owner account. Upgrade to invite collaborators.", nil)
	}
	pb.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		if ownerOnly(pb) {
			return denied()
		}
		return e.Next()
	})
	pb.OnRecordUpdateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		if ownerOnly(pb) && e.Record.Id != hostedOwnerID(pb) {
			return denied()
		}
		return e.Next()
	})
	assignment := func(e *core.RecordRequestEvent) error {
		if ownerOnly(pb) && (hostedOwnerID(pb) == "" || e.Record.GetString("user") != hostedOwnerID(pb)) {
			return denied()
		}
		return e.Next()
	}
	pb.OnRecordCreateRequest("site_role_assignments").BindFunc(assignment)
	pb.OnRecordUpdateRequest("site_role_assignments").BindFunc(assignment)
	pb.OnRecordAuthRequest("users").BindFunc(func(e *core.RecordAuthRequestEvent) error {
		if ownerOnly(pb) && e.Record.Id != hostedOwnerID(pb) {
			return denied()
		}
		return e.Next()
	})
}
