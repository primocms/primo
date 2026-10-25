package migrations

import (
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// TestRecoverySnapshotUploadLimit covers fresh installs, default upgrades, and
// preservation of custom limits and snapshot authorization rules.
func TestRecoverySnapshotUploadLimit(t *testing.T) {
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { app.ResetBootstrapState() })
	if err := app.RunAppMigrations(); err != nil {
		t.Fatal(err)
	}
	collection, err := app.FindCollectionByNameOrId("site_snapshots")
	if err != nil {
		t.Fatal(err)
	}
	if got := collection.Fields.GetByName("file").(*core.FileField).MaxSize; got != recoverySnapshotMaxSize {
		t.Fatalf("fresh installation limit = %d, want %d", got, recoverySnapshotMaxSize)
	}
	rules := []string{*collection.CreateRule, *collection.ListRule, *collection.ViewRule, *collection.DeleteRule}

	for _, tc := range []struct {
		name          string
		before, after int64
	}{
		{"implicit default", 0, recoverySnapshotMaxSize},
		{"explicit default", core.DefaultFileFieldMaxSize, recoverySnapshotMaxSize},
		{"custom smaller limit", 2 << 20, 2 << 20},
		{"custom larger limit", 512 << 20, 512 << 20},
		{"already migrated", recoverySnapshotMaxSize, recoverySnapshotMaxSize},
	} {
		t.Run(tc.name, func(t *testing.T) {
			collection.Fields.GetByName("file").(*core.FileField).MaxSize = tc.before
			if err := app.Save(collection); err != nil {
				t.Fatal(err)
			}
			if err := increaseRecoverySnapshotUploadLimit(app); err != nil {
				t.Fatal(err)
			}
			collection, err = app.FindCollectionByNameOrId("site_snapshots")
			if err != nil {
				t.Fatal(err)
			}
			if got := collection.Fields.GetByName("file").(*core.FileField).MaxSize; got != tc.after {
				t.Fatalf("limit = %d, want %d", got, tc.after)
			}
			gotRules := []string{*collection.CreateRule, *collection.ListRule, *collection.ViewRule, *collection.DeleteRule}
			for i := range rules {
				if gotRules[i] != rules[i] {
					t.Fatal("migration changed snapshot authorization rules")
				}
			}
			if collection.UpdateRule != nil {
				t.Fatal("snapshot updates must remain disabled")
			}
		})
	}
}
