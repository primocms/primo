package hosting

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"filippo.io/age"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	_ "github.com/primocms/primo/migrations"
)

func decryptTestBackup(t *testing.T, storage *filesystem.System, key string, identity *age.X25519Identity) []byte {
	t.Helper()
	r, err := storage.GetReader(key)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	plain, err := age.Decrypt(r, identity)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(plain)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestConsistentEncryptedControlBackupRestoresState(t *testing.T) {
	identity, err := age.GenerateX25519Identity()
	if err != nil {
		t.Fatal(err)
	}
	key := bytes.Repeat([]byte{42}, 32)
	filename := filepath.Join(t.TempDir(), "hosting.sqlite")
	store, err := OpenStore(filename, key)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	j := Job{ID: "backup-proof", Subscription: "subscription", Email: "owner@example.com", State: "ready"}
	j.Secrets, err = store.seal(j.ID+":credentials", `{"AdminPassword":"operator-password"}`)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Accept("event", "order.paid", "queued", &j); err != nil {
		t.Fatal(err)
	}
	storage, err := filesystem.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.Close()
	m := BackupManager{Config: Config{Database: filename, Backups: BackupConfig{Recipient: identity.Recipient().String()}}, Store: store}
	now := time.Date(2026, 10, 5, 3, 0, 0, 0, time.UTC)
	if err := m.control(context.Background(), storage, now); err != nil {
		t.Fatal(err)
	}
	plain := decryptTestBackup(t, storage, "control-plane/2026-10-05.sqlite.age", identity)
	restoredFile := filepath.Join(t.TempDir(), "restored.sqlite")
	if err := os.WriteFile(restoredFile, plain, 0600); err != nil {
		t.Fatal(err)
	}
	restored, err := OpenStore(restoredFile, key)
	if err != nil {
		t.Fatal(err)
	}
	defer restored.Close()
	got, err := restored.Get(j.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Email != j.Email || got.State != "ready" {
		t.Fatal("consistent snapshot lost committed job state")
	}
	credentials, err := restored.open(j.ID+":credentials", got.Secrets)
	if err != nil || !strings.Contains(credentials, "operator-password") {
		t.Fatal("restored bootstrap/support credentials unusable")
	}
	if err := m.control(context.Background(), storage, now); err != nil {
		t.Fatal(err)
	}
	status, err := store.BackupStatus()
	if err != nil || len(status) != 1 || status[0].CompletedAt != now.Unix() {
		t.Fatal("daily backup checkpoint missing")
	}
}

type failedBackupStorage struct{ *filesystem.System }

func (s failedBackupStorage) UploadFile(*filesystem.File, string) error {
	return errors.New("simulated unavailable storage")
}

func TestCustomerBackupRestoresPocketBaseAndFiles(t *testing.T) {
	t.Setenv("PRIMO_OWNER_ONLY", "")
	t.Setenv("PRIMO_USER_EMAIL", "")
	t.Setenv("PRIMO_USER_PASSWORD", "")
	t.Setenv("PRIMO_SUPERUSER_EMAIL", "")
	t.Setenv("PRIMO_SUPERUSER_PASSWORD", "")
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	defer app.ResetBootstrapState()
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	if err := app.RunAppMigrations(); err != nil {
		t.Fatal(err)
	}
	admins, err := app.FindCollectionByNameOrId("_superusers")
	if err != nil {
		t.Fatal(err)
	}
	admin := core.NewRecord(admins)
	admin.SetEmail("hosting-admin@primo.page")
	admin.SetPassword("operator-test-password")
	if err := app.Save(admin); err != nil {
		t.Fatal(err)
	}
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	owner := core.NewRecord(users)
	owner.SetEmail("owner@example.com")
	owner.SetPassword("owner-test-password")
	owner.Set("serverRole", "developer")
	owner.SetVerified(true)
	if err := app.Save(owner); err != nil {
		t.Fatal(err)
	}
	filePath := filepath.Join(app.DataDir(), "storage", "uploaded-proof.txt")
	if err := os.MkdirAll(filepath.Dir(filePath), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filePath, []byte("customer uploaded file proof"), 0600); err != nil {
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
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		w := httptest.NewRecorder()
		// Real net/http servers always provide a non-nil request body.
		if r.Body == nil {
			r.Body = http.NoBody
		}
		handler.ServeHTTP(w, r)
		return w.Result(), nil
	})}
	store, err := OpenStore(filepath.Join(t.TempDir(), "hosting.sqlite"), bytes.Repeat([]byte{42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	identity, err := age.GenerateX25519Identity()
	if err != nil {
		t.Fatal(err)
	}
	m := BackupManager{Config: Config{Domain: "primo.page", Backups: BackupConfig{Recipient: identity.Recipient().String()}}, Store: store, Client: client}
	j := Job{ID: "00112233445566778899aabb", Slug: "backup-test", App: "primo-c-00112233445566778899aabb", State: "ready"}
	raw, _ := json.Marshal(Credentials{AdminPassword: "operator-test-password"})
	j.Secrets, err = store.seal(j.ID+":credentials", string(raw))
	if err != nil {
		t.Fatal(err)
	}
	storage, err := filesystem.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer storage.Close()
	now := time.Date(2026, 10, 5, 3, 0, 0, 0, time.UTC)
	if err := m.customer(context.Background(), failedBackupStorage{storage}, j, now); err == nil {
		t.Fatal("failed upload reported success")
	}
	localBackups, err := app.NewBackupsFilesystem()
	if err != nil {
		t.Fatal(err)
	}
	defer localBackups.Close()
	if exists, err := localBackups.Exists("hosted_export_20261005.zip"); err != nil || !exists {
		t.Fatal("failed upload discarded the recoverable export")
	}
	if err := m.customer(context.Background(), storage, j, now); err != nil {
		t.Fatal(err)
	}
	if exists, err := localBackups.Exists("hosted_export_20261005.zip"); err != nil || exists {
		t.Fatal("verified upload left a temporary export to fill the customer volume")
	}
	plain := decryptTestBackup(t, storage, "customers/"+j.ID+"/2026-10-05.zip.age", identity)
	archive, err := zip.NewReader(bytes.NewReader(plain), int64(len(plain)))
	if err != nil {
		t.Fatal(err)
	}
	restoreDir := t.TempDir()
	for _, f := range archive.File {
		path := filepath.Join(restoreDir, filepath.FromSlash(f.Name))
		if !strings.HasPrefix(path, restoreDir+string(os.PathSeparator)) {
			t.Fatal("unsafe backup archive entry")
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(path, 0700); err != nil {
				t.Fatal(err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		r, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(r)
		r.Close()
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	restored := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: restoreDir})
	defer restored.ResetBootstrapState()
	if err := restored.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	restoredOwner, err := restored.FindRecordById("users", owner.Id)
	if err != nil || !restoredOwner.ValidatePassword("owner-test-password") || !restoredOwner.Verified() {
		t.Fatal("restored customer account cannot sign in")
	}
	file, err := os.ReadFile(filepath.Join(restoreDir, "storage", "uploaded-proof.txt"))
	if err != nil || string(file) != "customer uploaded file proof" {
		t.Fatal("uploaded file missing from restored backup")
	}
	if err := m.customer(context.Background(), storage, j, now); err != nil {
		t.Fatal(err)
	}
	j.Retired = true
	if err := m.customer(context.Background(), failedBackupStorage{storage}, j, now.Add(24*time.Hour)); err != nil {
		t.Fatal("retired test customer was backed up")
	}
}
