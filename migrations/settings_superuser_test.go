package migrations

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"testing"
)

func TestConfiguredSuperuserMigrationPreservesExistingUpsert(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { app.ResetBootstrapState() })
	collection, err := app.FindCollectionByNameOrId("_superusers")
	if err != nil {
		t.Fatal(err)
	}
	existing := core.NewRecord(collection)
	existing.SetEmail("operator@example.test")
	existing.SetPassword("Existing-password-123")
	if err := app.Save(existing); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PRIMO_SUPERUSER_EMAIL", existing.Email())
	t.Setenv("PRIMO_SUPERUSER_PASSWORD", "New-migration-password-123")
	if err := app.RunAppMigrations(); err != nil {
		t.Fatal(err)
	}
	saved, err := app.FindAuthRecordByEmail(collection, existing.Email())
	if err != nil || saved.Id != existing.Id || !saved.ValidatePassword("Existing-password-123") {
		t.Fatal("migration replaced configured account", err)
	}
}
