//go:build flybackup

package hosting

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"mime/multipart"
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
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/primocms/primo/internal"
)

// This explicit integration tag operates only on the disposable private Machine
// prepared by the operator. Credentials come from a mode-600 local file, never
// command arguments. Normal tests do not contact Fly or R2.
func TestFlyR2RestoreProof(t *testing.T) {
	filename := os.Getenv("PRIMO_BACKUP_PROOF_FILE")
	stat, err := os.Stat(filename)
	if err != nil || stat.Mode().Perm()&0077 != 0 {
		t.Fatal("private proof configuration required")
	}
	raw, err := os.ReadFile(filename)
	if err != nil {
		t.Fatal("proof configuration unavailable")
	}
	var proof struct{ JobID, Slug, Password, AdminPassword, InstanceID string }
	if json.Unmarshal(raw, &proof) != nil || proof.JobID == "" {
		t.Fatal("invalid proof configuration")
	}
	root := "/Users/mateo/Desktop/primo/.tools/fly/hosting"
	raw, err = os.ReadFile(filepath.Join(root, "r2-backup-key.json"))
	if err != nil {
		t.Fatal("private R2 configuration unavailable")
	}
	var r2 map[string]string
	if json.Unmarshal(raw, &r2) != nil {
		t.Fatal("invalid R2 configuration")
	}
	raw, err = os.ReadFile(filepath.Join(root, "backup-recovery.private.json"))
	if err != nil {
		t.Fatal("private recovery configuration unavailable")
	}
	var recovery map[string]string
	if json.Unmarshal(raw, &recovery) != nil {
		t.Fatal("invalid recovery configuration")
	}
	identity, err := age.ParseX25519Identity(recovery["age_identity"])
	if err != nil {
		t.Fatal("invalid recovery identity")
	}
	storage, err := filesystem.NewS3(r2["bucket"], r2["region"], r2["endpoint"], r2["access_key"], r2["secret_key"], true)
	if err != nil {
		t.Fatal("R2 initialization failed")
	}
	defer storage.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	storage.SetContext(ctx)

	// Recover the real deployed control backup, including the support secrets.
	raw, err = os.ReadFile(filepath.Join(root, "backup-worker-proof.json"))
	if err != nil {
		t.Fatal("deployed backup proof unavailable")
	}
	var worker struct {
		Status struct {
			Completed []BackupStatus `json:"completed"`
		} `json:"status"`
	}
	if json.Unmarshal(raw, &worker) != nil || len(worker.Status.Completed) != 1 {
		t.Fatal("deployed control backup missing")
	}
	controlKey := worker.Status.Completed[0].ObjectKey
	plain := decryptTestBackup(t, storage, controlKey, identity)
	controlFile := filepath.Join(t.TempDir(), "hosting.sqlite")
	if err := os.WriteFile(controlFile, plain, 0600); err != nil {
		t.Fatal(err)
	}
	key, err := base64.StdEncoding.DecodeString(recovery["control_encryption_key"])
	if err != nil {
		t.Fatal("control recovery key invalid")
	}
	control, err := OpenStore(controlFile, key)
	if err != nil {
		t.Fatal("control snapshot cannot be opened")
	}
	defer control.Close()
	jobs, err := control.Jobs()
	if err != nil || len(jobs) != 2 {
		t.Fatal("deployed job state was not restored")
	}
	for _, job := range jobs {
		if !job.Retired || job.State != "ready" {
			t.Fatal("retired test state was not restored")
		}
		secret, err := control.open(job.ID+":credentials", job.Secrets)
		if err != nil {
			t.Fatal("encrypted support state cannot be recovered")
		}
		var credentials Credentials
		if json.Unmarshal([]byte(secret), &credentials) != nil || credentials.AdminPassword == "" || credentials.Password != "" {
			t.Fatal("recovered support credentials invalid")
		}
	}
	t.Log("PASS: actual encrypted R2 control archive restores durable jobs and usable support credentials")

	// Access only the private test Machine through the loopback WireGuard proxy.
	host := proof.Slug + ".primo.page"
	transport := &http.Transport{}
	client := &http.Client{Timeout: 5 * time.Minute, Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Scheme != "https" || req.URL.Host != host {
			return nil, io.ErrUnexpectedEOF
		}
		clone := req.Clone(req.Context())
		copied := *req.URL
		clone.URL = &copied
		clone.URL.Scheme = "http"
		clone.URL.Host = "127.0.0.1:18082"
		return transport.RoundTrip(clone)
	})}
	base := "https://" + host
	var auth struct {
		Token  string `json:"token"`
		Record struct {
			ID           string `json:"id"`
			CollectionID string `json:"collectionId"`
		} `json:"record"`
	}
	if request(ctx, client, "POST", base+"/api/collections/users/auth-with-password", "", map[string]string{"identity": "bootstrap-customer@primo.page", "password": proof.Password}, &auth) != nil || auth.Token == "" {
		t.Fatal("private Maker owner sign-in failed")
	}
	var avatar bytes.Buffer
	if png.Encode(&avatar, image.NewRGBA(image.Rect(0, 0, 2, 2))) != nil {
		t.Fatal("test avatar creation failed")
	}
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	file, err := form.CreateFormFile("avatar", "backup-proof.png")
	if err != nil {
		t.Fatal(err)
	}
	file.Write(avatar.Bytes())
	form.WriteField("name", "R2 recovery proof")
	form.Close()
	req, _ := http.NewRequestWithContext(ctx, "PATCH", base+"/api/collections/users/records/"+auth.Record.ID, &body)
	req.Header.Set("Authorization", auth.Token)
	req.Header.Set("Content-Type", form.FormDataContentType())
	response, err := client.Do(req)
	if err != nil {
		t.Fatal("test uploaded file request failed")
	}
	var owner struct {
		Avatar string `json:"avatar"`
	}
	err = json.NewDecoder(response.Body).Decode(&owner)
	response.Body.Close()
	if err != nil || response.StatusCode != 200 || owner.Avatar == "" {
		t.Fatal("Maker owner profile/file update failed")
	}
	if err := request(ctx, client, "POST", base+"/api/collections/users/records", auth.Token, map[string]string{"email": "blocked@primo.page", "password": "blocked-test-password", "passwordConfirm": "blocked-test-password"}, nil); err != apiStatus(403) {
		t.Fatal("live Maker image permits collaborator creation")
	}

	store, err := OpenStore(filepath.Join(t.TempDir(), "proof.sqlite"), bytes.Repeat([]byte{42}, 32))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	config := Config{Domain: "primo.page", Backups: BackupConfig{Enabled: true, Bucket: r2["bucket"], Region: r2["region"], Endpoint: r2["endpoint"], AccessKey: r2["access_key"], Secret: r2["secret_key"], Recipient: identity.Recipient().String()}}
	if err := config.Backups.Validate(); err != nil {
		t.Fatal(err)
	}
	m := BackupManager{Config: config, Store: store, Client: client}
	j := Job{ID: proof.JobID, Slug: proof.Slug, App: "primo-c-" + proof.JobID, State: "ready", Plan: Plan{Name: "Maker", Sites: 3, OwnerOnly: true}}
	data, _ := json.Marshal(Credentials{AdminPassword: proof.AdminPassword})
	j.Secrets, err = store.seal(j.ID+":credentials", string(data))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	if err := m.customer(ctx, storage, j, now); err != nil {
		t.Fatal(err)
	}
	archiveKey := "customers/" + j.ID + "/" + now.UTC().Format("2006-01-02") + ".zip.age"
	plain = decryptTestBackup(t, storage, archiveKey, identity)
	archive, err := zip.NewReader(bytes.NewReader(plain), int64(len(plain)))
	if err != nil {
		t.Fatal("recovered PocketBase archive invalid")
	}
	restoreDir := t.TempDir()
	for _, file := range archive.File {
		path := filepath.Join(restoreDir, filepath.FromSlash(file.Name))
		if !strings.HasPrefix(path, restoreDir+string(os.PathSeparator)) {
			t.Fatal("unsafe recovery archive path")
		}
		if file.FileInfo().IsDir() {
			if os.MkdirAll(path, 0700) != nil {
				t.Fatal("recovery directory creation failed")
			}
			continue
		}
		if os.MkdirAll(filepath.Dir(path), 0700) != nil {
			t.Fatal("recovery directory creation failed")
		}
		r, err := file.Open()
		if err != nil {
			t.Fatal("recovery archive read failed")
		}
		content, err := io.ReadAll(r)
		r.Close()
		if err != nil || os.WriteFile(path, content, 0600) != nil {
			t.Fatal("recovery file extraction failed")
		}
	}
	restored := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: restoreDir})
	defer restored.ResetBootstrapState()
	if err := restored.Bootstrap(); err != nil {
		t.Fatal("restored PocketBase cannot boot")
	}
	restoredOwner, err := restored.FindRecordById("users", auth.Record.ID)
	if err != nil || !restoredOwner.ValidatePassword(proof.Password) || restoredOwner.GetString("name") != "R2 recovery proof" {
		t.Fatal("restored owner/profile missing")
	}
	content, err := os.ReadFile(filepath.Join(restoreDir, "storage", auth.Record.CollectionID, auth.Record.ID, owner.Avatar))
	if err != nil || !bytes.Equal(content, avatar.Bytes()) {
		t.Fatal("uploaded file did not survive real R2 recovery")
	}
	policy, err := restored.FindFirstRecordByData("config_values", "key", "owner_only")
	if err != nil || policy.GetString("value") != "true" {
		t.Fatal("owner-only policy did not survive recovery")
	}
	if internal.RegisterEditorLimit(restored) != nil {
		t.Fatal("restored owner policy cannot be registered")
	}
	router, err := apis.NewRouter(restored)
	if err != nil {
		t.Fatal(err)
	}
	handler, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	loginBody, _ := json.Marshal(map[string]string{"identity": "bootstrap-customer@primo.page", "password": proof.Password})
	login := httptest.NewRequest("POST", "/api/collections/users/auth-with-password", bytes.NewReader(loginBody))
	login.Header.Set("Content-Type", "application/json")
	result := httptest.NewRecorder()
	handler.ServeHTTP(result, login)
	if result.Code != 200 {
		t.Fatal("restored Maker owner cannot sign in")
	}
	// Store only nonsecret evidence, not the recovered database or passwords.
	evidence := map[string]any{"customer_archive": archiveKey, "control_archive": controlKey, "maker_owner_only": "passed on private Fly image and after restore", "uploaded_file_restore": "passed", "customer_sign_in_restore": "passed", "control_credentials_restore": "passed", "purpose": "disposable private image/R2 integration verification; no live customer", "image_version": "3.3.0-fly-smoke.4"}
	evidenceData, _ := json.MarshalIndent(evidence, "", "  ")
	if os.WriteFile(filepath.Join(root, "customer-backup-proof.json"), append(evidenceData, '\n'), 0600) != nil {
		t.Fatal("evidence save failed")
	}
	t.Log("PASS: real private Fly Maker database and uploaded file backed up to R2, decrypted, restored, and owner sign-in verified; collaborator creation rejected")
}
