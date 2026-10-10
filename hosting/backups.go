package hosting

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"filippo.io/age"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/filesystem/blob"
)

type BackupConfig struct {
	Enabled                                                bool
	Bucket, Region, Endpoint, AccessKey, Secret, Recipient string
}

type backupStorage interface {
	SetContext(context.Context)
	UploadFile(*filesystem.File, string) error
	GetReader(string) (*blob.Reader, error)
}

func (c BackupConfig) Validate() error {
	if !c.Enabled {
		return nil
	}
	if c.Bucket != "primo-hosted-backups" || c.Region != "auto" || c.Endpoint != "https://ff5f3f8917642d3f91fe4898a9d89ee2.r2.cloudflarestorage.com" || c.AccessKey == "" || c.Secret == "" {
		return errors.New("invalid private R2 backup configuration")
	}
	if _, err := age.ParseX25519Recipient(c.Recipient); err != nil {
		return errors.New("invalid backup encryption recipient")
	}
	return nil
}

// BackupManager retains all remote archives. Only its own temporary PocketBase
// export is removed, and only after the encrypted R2 object has been read back
// and compared. The decryption identity stays offline; Fly needs only a public
// encryption recipient. Customer apps receive no R2 credential.
type BackupManager struct {
	Config Config
	Store  *Store
	Client *http.Client
	Now    func() time.Time
	mu     sync.Mutex
}

type BackupStatus struct {
	Target      string `json:"target"`
	ObjectKey   string `json:"object_key"`
	CompletedAt int64  `json:"completed_at"`
}

func (s *Store) BackupStatus() ([]BackupStatus, error) {
	rows, err := s.db.Query("SELECT target,object_key,completed_at FROM backup_runs ORDER BY target")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []BackupStatus{}
	for rows.Next() {
		var status BackupStatus
		if err := rows.Scan(&status.Target, &status.ObjectKey, &status.CompletedAt); err != nil {
			return nil, err
		}
		out = append(out, status)
	}
	return out, rows.Err()
}

func (m *BackupManager) due(target string, now time.Time) (bool, error) {
	var completed int64
	err := m.Store.db.QueryRow("SELECT completed_at FROM backup_runs WHERE target=?", target).Scan(&completed)
	if errors.Is(err, sql.ErrNoRows) {
		return true, nil
	}
	return err == nil && time.Unix(completed, 0).UTC().Format("2006-01-02") != now.UTC().Format("2006-01-02"), err
}

func (m *BackupManager) completed(target, key string, now time.Time) error {
	_, err := m.Store.db.Exec("INSERT INTO backup_runs(target,object_key,completed_at) VALUES(?,?,?) ON CONFLICT(target) DO UPDATE SET object_key=excluded.object_key,completed_at=excluded.completed_at", target, key, now.Unix())
	return err
}

func encryptArchive(dst io.Writer, src io.Reader, recipient string) error {
	r, err := age.ParseX25519Recipient(recipient)
	if err != nil {
		return err
	}
	w, err := age.Encrypt(dst, r)
	if err != nil {
		return err
	}
	if _, err := io.Copy(w, src); err != nil {
		return err
	}
	return w.Close()
}

func (m *BackupManager) upload(ctx context.Context, storage backupStorage, key string, src io.Reader) error {
	f, err := os.CreateTemp("", "primo-backup-*.age")
	if err != nil {
		return errors.New("archive staging failed")
	}
	defer os.Remove(f.Name())
	defer f.Close()
	if err := encryptArchive(f, src, m.Config.Backups.Recipient); err != nil {
		return errors.New("archive encryption failed")
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return errors.New("archive verification failed")
	}
	want := sha256.New()
	if _, err := io.Copy(want, f); err != nil {
		return errors.New("archive verification failed")
	}
	file, err := filesystem.NewFileFromPath(f.Name())
	if err != nil {
		return errors.New("archive staging failed")
	}
	file.Name, file.OriginalName = filepath.Base(key), filepath.Base(key)
	storage.SetContext(ctx)
	if err := storage.UploadFile(file, key); err != nil {
		return errors.New("R2 upload failed")
	}
	reader, err := storage.GetReader(key)
	if err != nil {
		return errors.New("R2 read-back failed")
	}
	defer reader.Close()
	got := sha256.New()
	if _, err := io.Copy(got, reader); err != nil {
		return errors.New("R2 read-back failed")
	}
	if !strings.EqualFold(fmt.Sprintf("%x", want.Sum(nil)), fmt.Sprintf("%x", got.Sum(nil))) {
		return errors.New("R2 archive content mismatch")
	}
	return nil
}

func (m *BackupManager) control(ctx context.Context, storage backupStorage, now time.Time) error {
	due, err := m.due("control-plane", now)
	if err != nil || !due {
		return err
	}
	dir, err := os.MkdirTemp(filepath.Dir(m.Config.Database), "backup-snapshot-")
	if err != nil {
		return errors.New("SQLite snapshot staging failed")
	}
	defer os.RemoveAll(dir)
	filename := filepath.Join(dir, "hosting.sqlite")
	// VACUUM INTO produces a consistent standalone SQLite snapshot including
	// committed WAL data. The private parent directory prevents read access.
	if _, err := m.Store.db.ExecContext(ctx, "VACUUM INTO ?", filename); err != nil {
		return errors.New("SQLite consistent snapshot failed")
	}
	if err := os.Chmod(filename, 0600); err != nil {
		return errors.New("SQLite snapshot protection failed")
	}
	f, err := os.Open(filename)
	if err != nil {
		return errors.New("SQLite snapshot read failed")
	}
	defer f.Close()
	key := "control-plane/" + now.UTC().Format("2006-01-02") + ".sqlite.age"
	if err := m.upload(ctx, storage, key, f); err != nil {
		return err
	}
	return m.completed("control-plane", key, now)
}

func (m *BackupManager) customer(ctx context.Context, storage backupStorage, j Job, now time.Time) error {
	if j.Retired || j.State != "ready" || j.Suspension.Phase != "" || j.Suspension.CompletedAt > 0 {
		return nil
	}
	if !ValidSlug(j.Slug) || j.App != "primo-c-"+j.ID || m.Config.Domain != "primo.page" {
		return errors.New("customer backup identity mismatch")
	}
	due, err := m.due(j.ID, now)
	if err != nil || !due {
		return err
	}
	raw, err := m.Store.open(j.ID+":credentials", j.Secrets)
	if err != nil {
		return errors.New("customer operator credentials unavailable")
	}
	var credentials Credentials
	if json.Unmarshal([]byte(raw), &credentials) != nil || credentials.AdminPassword == "" {
		return errors.New("customer operator credentials unavailable")
	}
	base := "https://" + j.Slug + "." + m.Config.Domain
	var auth struct {
		Token string `json:"token"`
	}
	if err := request(ctx, m.Client, "POST", base+"/api/collections/_superusers/auth-with-password", "", map[string]string{"identity": "hosting-admin@primo.page", "password": credentials.AdminPassword}, &auth); err != nil || auth.Token == "" {
		return errors.New("customer backup sign-in failed")
	}
	var settings struct {
		S3 struct {
			Enabled bool `json:"enabled"`
		} `json:"s3"`
	}
	if err := request(ctx, m.Client, "GET", base+"/api/settings", auth.Token, nil, &settings); err != nil {
		return errors.New("customer storage verification failed")
	}
	if settings.S3.Enabled {
		return errors.New("external customer uploads need a separate backup integration")
	}
	var backups []struct {
		Key  string `json:"key"`
		Size int64  `json:"size"`
	}
	if err := request(ctx, m.Client, "GET", base+"/api/backups", auth.Token, nil, &backups); err != nil {
		return errors.New("customer backup listing failed")
	}
	name := "hosted_export_" + now.UTC().Format("20060102") + ".zip"
	exists := false
	for _, b := range backups {
		if b.Key == name && b.Size > 0 {
			exists = true
		}
	}
	if !exists {
		if err := request(ctx, m.Client, "POST", base+"/api/backups", auth.Token, map[string]string{"name": name}, nil); err != nil {
			return errors.New("consistent customer backup creation failed")
		}
	}
	var fileToken struct {
		Token string `json:"token"`
	}
	if err := request(ctx, m.Client, "POST", base+"/api/files/token", auth.Token, nil, &fileToken); err != nil || fileToken.Token == "" {
		return errors.New("customer backup download authorization failed")
	}
	req, err := http.NewRequestWithContext(ctx, "GET", base+"/api/backups/"+name+"?token="+url.QueryEscape(fileToken.Token), nil)
	if err != nil {
		return errors.New("customer backup download failed")
	}
	client := *m.Client
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	response, err := client.Do(req)
	if err != nil {
		return errors.New("customer backup download failed")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return errors.New("customer backup download failed")
	}
	key := "customers/" + j.ID + "/" + now.UTC().Format("2006-01-02") + ".zip.age"
	if err := m.upload(ctx, storage, key, response.Body); err != nil {
		return err
	}
	// This is an export generated by this backup manager, never the live data
	// or a native cron backup. Keep it locally on any upload/read-back failure.
	if err := request(ctx, m.Client, "DELETE", base+"/api/backups/"+name, auth.Token, nil, nil); err != nil {
		return errors.New("temporary customer export cleanup failed")
	}
	return m.completed(j.ID, key, now)
}

// Run is safe to repeat hourly and across process restarts; successful targets
// are checkpointed once per UTC day. Failed targets remain due for retry.
func (m *BackupManager) Run(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.Config.Backups.Enabled {
		return nil
	}
	if err := m.Config.Backups.Validate(); err != nil {
		return err
	}
	now := time.Now()
	if m.Now != nil {
		now = m.Now()
	}
	storage, err := filesystem.NewS3(m.Config.Backups.Bucket, m.Config.Backups.Region, m.Config.Backups.Endpoint, m.Config.Backups.AccessKey, m.Config.Backups.Secret, true)
	if err != nil {
		return errors.New("backup storage unavailable")
	}
	defer storage.Close()
	var failures []error
	controlCtx, stopControl := context.WithTimeout(ctx, 5*time.Minute)
	if err := m.control(controlCtx, storage, now); err != nil {
		failures = append(failures, err)
	}
	stopControl()
	jobs, err := m.Store.Jobs()
	if err != nil {
		return errors.Join(append(failures, errors.New("backup customer listing failed"))...)
	}
	for _, j := range jobs {
		if ctx.Err() != nil {
			failures = append(failures, errors.New("backup run interrupted"))
			break
		}
		customerCtx, stopCustomer := context.WithTimeout(ctx, 15*time.Minute)
		if err := m.customer(customerCtx, storage, j, now); err != nil {
			failures = append(failures, fmt.Errorf("customer %s: %w", j.ID, err))
		}
		stopCustomer()
	}
	return errors.Join(failures...)
}
