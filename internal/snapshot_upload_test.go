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
)

type snapshotZeroReader struct{}

func (snapshotZeroReader) Read(p []byte) (int, error) {
	clear(p)
	return len(p), nil
}

func TestRecoverySnapshotUploadAcceptsLargeFiles(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
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
