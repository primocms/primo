package migrations

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// A recovery snapshot contains the site's referenced media as well as records,
// so the default limit for a single uploaded asset is too small for backups.
const recoverySnapshotMaxSize int64 = 256 << 20

func increaseRecoverySnapshotUploadLimit(app core.App) error {
	collection, err := app.FindCollectionByNameOrId("site_snapshots")
	if err != nil {
		return err
	}
	field, ok := collection.Fields.GetByName("file").(*core.FileField)
	if !ok {
		return fmt.Errorf("site_snapshots.file is not a file field")
	}
	// Preserve operator-configured limits, including deliberately stricter ones.
	if field.MaxSize != 0 && field.MaxSize != core.DefaultFileFieldMaxSize {
		return nil
	}
	field.MaxSize = recoverySnapshotMaxSize
	return app.Save(collection)
}

func init() {
	m.Register(increaseRecoverySnapshotUploadLimit, func(app core.App) error {
		// Keep uploaded recovery files usable when rolling back the application.
		return nil
	})
}
