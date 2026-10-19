package internal

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestOwnerOnlyBlocksCollaboratorsThroughAPI(t *testing.T) {
	t.Setenv("PRIMO_OWNER_ONLY", "true")
	t.Setenv("PRIMO_USER_EMAIL", "owner@example.com")
	t.Setenv("PRIMO_USER_PASSWORD", "owner-test-password")
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	if !ownerOnly(app) || hostedOwnerID(app) == "" {
		t.Fatal("owner-only policy was not persisted")
	}
	// Removing first-boot environment variables must not remove the policy.
	t.Setenv("PRIMO_OWNER_ONLY", "")
	t.Setenv("PRIMO_USER_EMAIL", "")
	if !ownerOnly(app) {
		t.Fatal("owner-only policy lost after bootstrap cleanup")
	}
	owner, err := app.FindRecordById("users", hostedOwnerID(app))
	if err != nil {
		t.Fatal(err)
	}
	collection, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	// An operator/internal save can restore data. It must not grant customer
	// API callers a bypass for invitations, assignment edits, or sign-in.
	other := core.NewRecord(collection)
	other.SetEmail("other@example.com")
	other.SetPassword("other-test-password")
	if err := app.Save(other); err != nil {
		t.Fatal(err)
	}
	site := createImportTestSite(t, app)
	assignments, err := app.FindCollectionByNameOrId("site_role_assignments")
	if err != nil {
		t.Fatal(err)
	}
	assignment := core.NewRecord(assignments)
	assignment.Set("site", site.Id)
	assignment.Set("user", owner.Id)
	assignment.Set("role", "developer")
	if err := app.Save(assignment); err != nil {
		t.Fatal(err)
	}
	if err := RegisterEditorLimit(app); err != nil {
		t.Fatal(err)
	}
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	handler, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	token, err := owner.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name, method, path, body string
		status                   int
	}{
		{"invite", "POST", "/api/collections/users/records", `{"email":"invite@example.com","password":"invite-test-password","passwordConfirm":"invite-test-password"}`, 403},
		{"grant editor", "POST", "/api/collections/site_role_assignments/records", `{"site":"` + site.Id + `","user":"` + other.Id + `","role":"editor"}`, 403},
		{"grant developer", "POST", "/api/collections/site_role_assignments/records", `{"site":"` + site.Id + `","user":"` + other.Id + `","role":"developer"}`, 403},
		{"change assignment user", "PATCH", "/api/collections/site_role_assignments/records/" + assignment.Id, `{"user":"` + other.Id + `"}`, 403},
		{"promote other user", "PATCH", "/api/collections/users/records/" + other.Id, `{"serverRole":"developer"}`, 403},
		{"owner profile", "PATCH", "/api/collections/users/records/" + owner.Id, `{"name":"Owner"}`, 200},
		{"owner login", "POST", "/api/collections/users/auth-with-password", `{"identity":"owner@example.com","password":"owner-test-password"}`, 200},
		{"other login", "POST", "/api/collections/users/auth-with-password", `{"identity":"other@example.com","password":"other-test-password"}`, 403},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", token)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			if response.Code != tc.status {
				t.Fatalf("status %d, want %d: %s", response.Code, tc.status, response.Body.String())
			}
		})
	}
	if _, err := app.FindFirstRecordByData("users", "email", "invite@example.com"); err == nil {
		t.Fatal("rejected invite created an account")
	}
	stored, err := app.FindRecordById("site_role_assignments", assignment.Id)
	if err != nil || stored.GetString("user") != owner.Id {
		t.Fatal("rejected update changed access")
	}
}

func TestOwnerOnlyBootstrapRequiresOwner(t *testing.T) {
	t.Setenv("PRIMO_OWNER_ONLY", "true")
	t.Setenv("PRIMO_USER_EMAIL", "")
	t.Setenv("PRIMO_USER_PASSWORD", "")
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	defer app.ResetBootstrapState()
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	if err := app.RunAppMigrations(); err == nil {
		t.Fatal("missing owner permitted owner-only bootstrap")
	}
}

// An already provisioned owner remains authoritative when upgrades/restarts
// have removed seed secrets. Replaying this migration must not select a new owner.
func TestOwnerOnlyMigrationPreservesStoredOwnerWithoutSeedSecrets(t *testing.T) {
	t.Setenv("PRIMO_OWNER_ONLY", "true")
	t.Setenv("PRIMO_USER_EMAIL", "persisted-owner@example.com")
	t.Setenv("PRIMO_USER_PASSWORD", "persisted-owner-password")
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()
	id := hostedOwnerID(app)
	if id == "" {
		t.Fatal("owner missing")
	}
	t.Setenv("PRIMO_USER_EMAIL", "")
	t.Setenv("PRIMO_USER_PASSWORD", "")
	if _, err := app.DB().NewQuery("DELETE FROM _migrations WHERE file = '1791150000_hosted_owner_only.go'").Execute(); err != nil {
		t.Fatal(err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("preserve stored owner: %v", err)
	}
	if hostedOwnerID(app) != id || !ownerOnly(app) {
		t.Fatal("upgrade changed owner policy")
	}
}
