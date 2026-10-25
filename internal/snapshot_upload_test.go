package internal

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/router"
)

type snapshotZeroReader struct{}

type snapshotReadCounter struct {
	io.ReadCloser
	reads int
}

// Read records whether an upload body was consumed before its request was rejected.
func (r *snapshotReadCounter) Read(p []byte) (int, error) {
	r.reads++
	return r.ReadCloser.Read(p)
}

// Read fills the destination without allocating a complete upload in the test.
func (snapshotZeroReader) Read(p []byte) (int, error) {
	clear(p)
	return len(p), nil
}

// TestRecoverySnapshotUploadAcceptsLargeFiles checks stored bytes, both request
// size enforcement paths, and rejection of unauthenticated snapshot creation.
func TestRecoverySnapshotUploadAcceptsLargeFiles(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterRecoverySnapshotUploads(app); err != nil {
		t.Fatal(err)
	}
	site := createImportTestSite(t, app)
	handler, token := pushTestHTTP(t, app)

	// Exceed both the old 5 MiB file limit and old 37 MiB multipart body limit.
	const size = 40 << 20
	file, err := os.CreateTemp(t.TempDir(), "snapshot-request")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { file.Close() })
	w := multipart.NewWriter(file)
	if err := w.WriteField("site", site.Id); err != nil {
		t.Fatal(err)
	}
	part, err := w.CreateFormFile("file", "snapshot.bin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.CopyN(part, snapshotZeroReader{}, size); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	info, err := file.Stat()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/collections/site_snapshots/records", file)
	req.ContentLength = info.Size()
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", token)
	response := pushHTTP(t, handler, req, http.StatusOK)
	var created struct {
		ID   string `json:"id"`
		File string `json:"file"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.File == "" {
		t.Fatal("upload did not create a stored snapshot")
	}
	stored, err := app.FindRecordById("site_snapshots", created.ID)
	if err != nil {
		t.Fatal(err)
	}
	fs, err := app.NewFilesystem()
	if err != nil {
		t.Fatal(err)
	}
	defer fs.Close()
	attrs, err := fs.Attributes(stored.BaseFilesPath() + "/" + created.File)
	if err != nil {
		t.Fatal(err)
	}
	if attrs.Size != size {
		t.Fatalf("stored %d bytes, want %d", attrs.Size, size)
	}

	// Raising the per-file limit also sets a finite multipart request bound.
	oversized := httptest.NewRequest(http.MethodPost, "/api/collections/site_snapshots/records", strings.NewReader(""))
	oversized.ContentLength = (256+32)<<20 + 1
	oversized.Header.Set("Content-Type", w.FormDataContentType())
	oversized.Header.Set("Authorization", token)
	pushHTTP(t, handler, oversized, http.StatusRequestEntityTooLarge)

	// Stream actual multipart bytes without a declared size. This exercises
	// PocketBase's limitedReader rather than only its Content-Length shortcut.
	streamed := snapshotUploadRequest(t, site.Id, (256+32)<<20+1)
	streamed.Header.Set("Authorization", token)
	pushHTTP(t, handler, streamed, http.StatusRequestEntityTooLarge)

	var unauthorizedBody bytes.Buffer
	unauthorizedForm := multipart.NewWriter(&unauthorizedBody)
	if err := unauthorizedForm.WriteField("site", site.Id); err != nil {
		t.Fatal(err)
	}
	unauthorizedFile, err := unauthorizedForm.CreateFormFile("file", "snapshot.bin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := unauthorizedFile.Write([]byte("snapshot")); err != nil {
		t.Fatal(err)
	}
	if err := unauthorizedForm.Close(); err != nil {
		t.Fatal(err)
	}
	unauthorized := httptest.NewRequest(http.MethodPost, "/api/collections/site_snapshots/records", &unauthorizedBody)
	unauthorized.Header.Set("Content-Type", unauthorizedForm.FormDataContentType())
	denied := httptest.NewRecorder()
	handler.ServeHTTP(denied, unauthorized)
	if denied.Code < 400 {
		t.Fatalf("unauthenticated snapshot creation returned %d", denied.Code)
	}
	count, err := app.CountRecords("site_snapshots")
	if err != nil || count != 1 {
		t.Fatalf("unexpected snapshot count %d: %v", count, err)
	}
}

// snapshotUploadRequest constructs a finite multipart stream with unknown length.
func snapshotUploadRequest(t *testing.T, site string, size int64) *http.Request {
	t.Helper()
	var prefix bytes.Buffer
	w := multipart.NewWriter(&prefix)
	if err := w.WriteField("site", site); err != nil {
		t.Fatal(err)
	}
	if _, err := w.CreateFormFile("file", "snapshot.bin"); err != nil {
		t.Fatal(err)
	}
	head := append([]byte(nil), prefix.Bytes()...)
	prefix.Reset()
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	body := io.MultiReader(bytes.NewReader(head), io.LimitReader(snapshotZeroReader{}, size), bytes.NewReader(prefix.Bytes()))
	req := httptest.NewRequest(http.MethodPost, "/api/collections/site_snapshots/records", body)
	req.ContentLength = -1
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

// TestRecoverySnapshotUploadSpillsToDisk verifies an upload at the full 256 MiB
// limit uses a temporary file, avoids the replay buffer, and cleans up afterward.
func TestRecoverySnapshotUploadSpillsToDisk(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterRecoverySnapshotUploads(app); err != nil {
		t.Fatal(err)
	}
	var replay *router.RereadableReadCloser
	var temporaryPath string
	app.OnServe().BindFunc(func(event *core.ServeEvent) error {
		event.Router.Bind(&hook.Handler[*core.RequestEvent]{
			Priority: apis.DefaultBodyLimitMiddlewarePriority - 2,
			Func: func(e *core.RequestEvent) error {
				replay = e.Request.Body.(*router.RereadableReadCloser)
				return e.Next()
			},
		})
		return event.Next()
	})
	app.OnRecordCreateRequest("site_snapshots").BindFunc(func(e *core.RecordRequestEvent) error {
		file, err := e.Request.MultipartForm.File["file"][0].Open()
		if err != nil {
			t.Fatal(err)
		}
		diskFile, ok := file.(*os.File)
		if !ok {
			t.Fatal("large snapshot was retained in memory")
		}
		temporaryPath = diskFile.Name()
		file.Close()
		return e.Next()
	})
	site := createImportTestSite(t, app)
	handler, token := pushTestHTTP(t, app)
	collection, err := app.FindCollectionByNameOrId("site_snapshots")
	if err != nil {
		t.Fatal(err)
	}
	req := snapshotUploadRequest(t, site.Id, 256<<20)
	// Both collection names and IDs must use the streaming path.
	req.URL.Path = "/api/collections/" + collection.Id + "/records"
	req.Header.Set("Authorization", token)
	pushHTTP(t, handler, req, http.StatusOK)
	if _, err := os.Stat(temporaryPath); !os.IsNotExist(err) {
		t.Fatalf("multipart temporary file was not removed: %v", err)
	}
	// An unwrapped replay reader can have only an unread multipart terminator;
	// a retained body copy would yield at least this entire 4 KiB sample.
	remaining, err := io.ReadAll(io.LimitReader(replay, 4096))
	if err != nil || len(remaining) >= 4096 {
		t.Fatalf("snapshot body was copied into the replay buffer: bytes=%d, err=%v", len(remaining), err)
	}
}

// TestRecoverySnapshotUploadRateLimitPrecedesBodyRead ensures the streaming
// middleware does not parse uploads before PocketBase's collection rate check.
func TestRecoverySnapshotUploadRateLimitPrecedesBodyRead(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterRecoverySnapshotUploads(app); err != nil {
		t.Fatal(err)
	}
	app.Settings().RateLimits.Enabled = true
	app.Settings().RateLimits.Rules = []core.RateLimitRule{{
		Label: "site_snapshots:create", MaxRequests: 1, Duration: 60,
		Audience: core.RateLimitRuleAudienceAll,
	}}
	site := createImportTestSite(t, app)
	handler, token := pushTestHTTP(t, app)
	first := snapshotUploadRequest(t, site.Id, 16)
	first.Header.Set("Authorization", token)
	pushHTTP(t, handler, first, http.StatusOK)
	second := snapshotUploadRequest(t, site.Id, 40<<20)
	second.Header.Set("Authorization", token)
	counter := &snapshotReadCounter{ReadCloser: second.Body}
	second.Body = counter
	pushHTTP(t, handler, second, http.StatusTooManyRequests)
	if counter.reads != 0 {
		t.Fatalf("rate-limited upload body was read %d times", counter.reads)
	}
}

// TestRecoverySnapshotUploadAuthenticationPrecedesBodyRead rejects missing or
// invalid credentials without reading large uploads, even without rate limits.
func TestRecoverySnapshotUploadAuthenticationPrecedesBodyRead(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterRecoverySnapshotUploads(app); err != nil {
		t.Fatal(err)
	}
	app.Settings().RateLimits.Enabled = false
	site := createImportTestSite(t, app)
	handler, _ := pushTestHTTP(t, app)
	collection, err := app.FindCollectionByNameOrId("site_snapshots")
	if err != nil {
		t.Fatal(err)
	}
	for _, collectionRef := range []string{collection.Name, collection.Id} {
		for _, credential := range []string{"", "invalid-token"} {
			req := snapshotUploadRequest(t, site.Id, 256<<20)
			req.URL.Path = "/api/collections/" + collectionRef + "/records"
			if credential != "" {
				req.Header.Set("Authorization", credential)
			}
			counter := &snapshotReadCounter{ReadCloser: req.Body}
			req.Body = counter
			pushHTTP(t, handler, req, http.StatusUnauthorized)
			if counter.reads != 0 || req.MultipartForm != nil {
				t.Fatalf("unauthenticated upload was parsed: reads=%d, form=%v", counter.reads, req.MultipartForm)
			}
		}
	}
	if count, err := app.CountRecords("site_snapshots"); err != nil || count != 0 {
		t.Fatalf("unauthenticated uploads created %d snapshots: %v", count, err)
	}
}
