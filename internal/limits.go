package internal

import (
	"os"
	"strconv"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// Plan limits for a managed (hosted) instance. Caps are read from the
// config_values collection first (so they can be provisioned/changed per
// instance at runtime), falling back to the PRIMO_SITE_CAP / PRIMO_EDITOR_CAP
// env vars. A cap of 0 (or unset/unparseable) means unlimited — self-hosters
// and anyone who hasn't provisioned a cap are never restricted.
//
// Enforcement lives on the record-create *request* hooks so it covers every
// user-initiated path (dashboard direct collection writes, `primo push` /
// import, clone) in one place, while leaving server-side provisioning — the
// bootstrap/settings migration that seeds the first user, and internal clones
// run outside an API request — unaffected, since those don't go through the
// request hook.
//
// The count-then-create in each hook is not atomic (TOCTOU): two truly
// simultaneous creates can both pass the count and exceed the cap by one. We
// accept this deliberately — these are rare, manual, single-operator actions
// (create site / invite editor), the cap is a soft business limit rather than a
// security boundary, and the worst case is off-by-one. A mutex across the hook
// would serialize every create for a race that effectively can't occur at this
// scale; if strict enforcement is ever needed, reconcile in an
// OnRecordAfterCreate* hook instead.

// getCap reads an integer cap by config_values key, falling back to an env var.
// Returns 0 when unset/invalid, which callers treat as "unlimited".
func getCap(pb *pocketbase.PocketBase, configKey, envVar string) int {
	if collection, err := pb.FindCollectionByNameOrId("config_values"); err == nil {
		if record, err := pb.FindFirstRecordByData(collection.Id, "key", configKey); err == nil {
			if n, err := strconv.Atoi(record.GetString("value")); err == nil && n > 0 {
				return n
			}
		}
	}

	if n, err := strconv.Atoi(os.Getenv(envVar)); err == nil && n > 0 {
		return n
	}

	return 0
}

// RegisterSiteLimit rejects site creation once the instance is at its plan's
// site cap. This is the high-value guard: a created site holds real content and
// possibly a live domain, so an over-cap site is effectively impossible to claw
// back — unlike an over-cap editor, which is a one-click removal.
func RegisterSiteLimit(pb *pocketbase.PocketBase) error {
	pb.OnRecordCreateRequest("sites").BindFunc(func(e *core.RecordRequestEvent) error {
		cap := getCap(pb, "site_cap", "PRIMO_SITE_CAP")
		if cap > 0 {
			count, err := pb.CountRecords("sites")
			if err != nil {
				return err
			}
			if count >= int64(cap) {
				return apis.NewBadRequestError(
					"Site limit reached for your plan. Upgrade to add more sites.", nil)
			}
		}
		return e.Next()
	})

	return nil
}

// RegisterEditorLimit rejects adding another editor to a site once that site is
// at its plan's per-site editor cap — matching the pricing copy ("N editors per
// site"). Editors are users linked to a site through a site_role_assignments
// record with role "editor"; the invite flow creates exactly that record (see
// invitation.go), so guarding its creation covers both email invites and
// generated links. Only the "editor" role counts — developers/owners are not
// billed editor seats. Cap of 0 means unlimited. Low risk regardless: an
// over-cap assignment is trivially reversible.
func RegisterEditorLimit(pb *pocketbase.PocketBase) error {
	pb.OnRecordCreateRequest("site_role_assignments").BindFunc(func(e *core.RecordRequestEvent) error {
		cap := getCap(pb, "editor_cap", "PRIMO_EDITOR_CAP")
		if cap > 0 && e.Record.GetString("role") == "editor" {
			siteId := e.Record.GetString("site")
			count, err := pb.CountRecords("site_role_assignments",
				dbx.HashExp{"site": siteId, "role": "editor"})
			if err != nil {
				return err
			}
			if count >= int64(cap) {
				return apis.NewBadRequestError(
					"Editor limit reached for this site on your plan. Upgrade to add more editors.", nil)
			}
		}
		return e.Next()
	})

	return nil
}
