package migrations

import (
	"database/sql"
	"errors"
	"os"
	"slices"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("config_values")
		if err != nil {
			return err
		}
		field, ok := collection.Fields.GetByName("key").(*core.SelectField)
		if !ok {
			return errors.New("missing configuration key field")
		}
		for _, key := range []string{"owner_only", "hosted_owner_id"} {
			if !slices.Contains(field.Values, key) {
				field.Values = append(field.Values, key)
			}
		}
		if err := app.Save(collection); err != nil {
			return err
		}
		if os.Getenv("PRIMO_OWNER_ONLY") != "true" {
			return nil
		}
		var owner *core.Record
		if stored, lookupErr := app.FindFirstRecordByData(collection, "key", "hosted_owner_id"); lookupErr == nil {
			owner, err = app.FindRecordById("users", stored.GetString("value"))
		} else if errors.Is(lookupErr, sql.ErrNoRows) {
			owner, err = app.FindFirstRecordByData("users", "email", os.Getenv("PRIMO_USER_EMAIL"))
		} else {
			return lookupErr
		}
		if err != nil || owner.GetString("serverRole") != "developer" || !owner.Verified() {
			return errors.New("owner-only bootstrap requires a verified owner")
		}
		for key, value := range map[string]string{"owner_only": "true", "hosted_owner_id": owner.Id} {
			if _, err := app.FindFirstRecordByData(collection, "key", key); err == nil {
				continue
			} else if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			record := core.NewRecord(collection)
			record.Set("key", key)
			record.Set("value", value)
			if err := app.Save(record); err != nil {
				return err
			}
		}
		return nil
	}, func(app core.App) error { return nil })
}
