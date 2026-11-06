package migrations

import (
	"database/sql"
	"errors"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("config_values")
		if err != nil {
			return err
		}
		// The legacy telemetry key only allowed instance_id. Preserve it and
		// extend the select so both fresh installs and existing servers accept caps.
		if field, ok := collection.Fields.GetByName("key").(*core.SelectField); ok {
			for _, key := range []string{"site_cap", "editor_cap"} {
				if !slices.Contains(field.Values, key) {
					field.Values = append(field.Values, key)
				}
			}
			if err := app.Save(collection); err != nil {
				return err
			}
		}

		for _, cap := range []struct{ envVar, key string }{
			{"PRIMO_SITE_CAP", "site_cap"},
			{"PRIMO_EDITOR_CAP", "editor_cap"},
		} {
			value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(cap.envVar)))
			if err != nil || value <= 0 {
				continue
			}
			// An operator's stored configuration takes precedence during upgrades.
			if _, err := app.FindFirstRecordByData(collection, "key", cap.key); err == nil {
				continue
			} else if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			record := core.NewRecord(collection)
			record.Set("key", cap.key)
			record.Set("value", strconv.Itoa(value))
			if err := app.Save(record); err != nil {
				return err
			}
		}
		return nil
	}, func(app core.App) error {
		// Retain configuration on rollback rather than discarding plan settings.
		return nil
	})
}
