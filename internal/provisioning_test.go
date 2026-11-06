package internal

import (
	"testing"

	"github.com/pocketbase/pocketbase"
)

// Hosted provisioning sets caps before the first boot, while the configuration
// collection still has its historical name until a later migration renames it.
func TestHostedFirstBootSeedsPlanCaps(t *testing.T) {
	t.Setenv("PRIMO_SITE_CAP", "7")
	t.Setenv("PRIMO_EDITOR_CAP", "2")
	t.Setenv("PRIMO_SUPERUSER_EMAIL", "admin@example.com")
	t.Setenv("PRIMO_SUPERUSER_PASSWORD", "hosted-test-password")
	t.Setenv("PRIMO_USER_EMAIL", "customer@example.com")
	t.Setenv("PRIMO_USER_PASSWORD", "hosted-test-password")

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	defer app.ResetBootstrapState()
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("first-boot migrations: %v", err)
	}

	for key, want := range map[string]string{"site_cap": "7", "editor_cap": "2"} {
		record, err := app.FindFirstRecordByData("config_values", "key", key)
		if err != nil {
			t.Fatalf("seeded %s: %v", key, err)
		}
		if got := record.GetString("value"); got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
	if _, err := app.FindFirstRecordByData("_superusers", "email", "admin@example.com"); err != nil {
		t.Fatalf("seeded superuser: %v", err)
	}
	user, err := app.FindFirstRecordByData("users", "email", "customer@example.com")
	if err != nil {
		t.Fatalf("seeded customer: %v", err)
	}
	if user.GetString("serverRole") != "developer" || !user.Verified() {
		t.Fatal("seeded customer must be a verified developer")
	}
	if err := checkManagedBootstrap(app); err != nil {
		t.Fatalf("managed bootstrap: %v", err)
	}
	user.SetVerified(false)
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	if err := checkManagedBootstrap(app); err == nil {
		t.Fatal("managed server can listen before customer is verified")
	}
	user.SetVerified(true)
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}

	// Simulate upgrading an instance with an operator's stored cap. Only the
	// new cap migration is pending; the original settings migration stays applied.
	storedCap, err := app.FindFirstRecordByData("config_values", "key", "site_cap")
	if err != nil {
		t.Fatal(err)
	}
	storedCap.Set("value", "5")
	if err := app.Save(storedCap); err != nil {
		t.Fatal(err)
	}
	result, err := app.DB().NewQuery("DELETE FROM _migrations WHERE file = '1791148000_hosted_plan_caps.go'").Execute()
	if err != nil {
		t.Fatal(err)
	}
	if count, err := result.RowsAffected(); err != nil || count != 1 {
		t.Fatalf("expected one pending migration, affected=%d err=%v", count, err)
	}
	t.Setenv("PRIMO_SITE_CAP", "99")
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("upgrade migrations: %v", err)
	}
	if got := getCap(app, "site_cap", "PRIMO_SITE_CAP"); got != 5 {
		t.Errorf("stored site cap after upgrade = %d, want 5", got)
	}
}

func TestFirstBootWithoutPositivePlanCaps(t *testing.T) {
	for _, value := range []string{"", "0", "-1", "invalid"} {
		t.Run("cap="+value, func(t *testing.T) {
			t.Setenv("PRIMO_SITE_CAP", value)
			t.Setenv("PRIMO_EDITOR_CAP", value)
			t.Setenv("PRIMO_SUPERUSER_EMAIL", "")
			t.Setenv("PRIMO_SUPERUSER_PASSWORD", "")
			t.Setenv("PRIMO_USER_EMAIL", "")
			t.Setenv("PRIMO_USER_PASSWORD", "")
			app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
			defer app.ResetBootstrapState()
			if err := app.Bootstrap(); err != nil {
				t.Fatal(err)
			}
			if err := app.RunAppMigrations(); err != nil {
				t.Fatalf("first-boot migrations: %v", err)
			}
			if err := checkManagedBootstrap(app); err == nil {
				t.Fatal("managed server permits public setup with no owner")
			}
			for _, key := range []string{"site_cap", "editor_cap"} {
				if _, err := app.FindFirstRecordByData("config_values", "key", key); err == nil {
					t.Errorf("unexpected seeded cap %s", key)
				}
			}
		})
	}
}

func TestFirstBootRejectsInvalidBootstrapAccount(t *testing.T) {
	t.Setenv("PRIMO_SUPERUSER_EMAIL", "invalid-email")
	t.Setenv("PRIMO_SUPERUSER_PASSWORD", "a sufficiently long password")
	t.Setenv("PRIMO_USER_EMAIL", "")
	t.Setenv("PRIMO_USER_PASSWORD", "")
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	defer app.ResetBootstrapState()
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	if err := app.RunAppMigrations(); err == nil {
		t.Fatal("invalid bootstrap credentials silently ignored")
	}
}
