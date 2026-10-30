package internal

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase"
)

func chunkHash(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }
func chunkStart(t *testing.T, h http.Handler, token, endpoint string, data []byte) string {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"endpoint": endpoint, "size": len(data), "sha256": chunkHash(data)})
	req := httptest.NewRequest("POST", "/api/primo/import-uploads", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)
	response := pushHTTP(t, h, req, 201)
	var result struct {
		ID string `json:"upload_id"`
	}
	json.Unmarshal(response.Body.Bytes(), &result)
	if len(result.ID) != 64 {
		t.Fatal("missing session capability")
	}
	return result.ID
}
func chunkPut(t *testing.T, h http.Handler, token, id string, offset int, data []byte, status int) {
	t.Helper()
	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/primo/import-uploads/%s?offset=%d", id, offset), bytes.NewReader(data))
	req.Header.Set("Authorization", token)
	req.Header.Set("X-Primo-Chunk-SHA256", chunkHash(data))
	pushHTTP(t, h, req, status)
}
func chunkCommit(t *testing.T, h http.Handler, token, endpoint, id, revision string, status int) *httptest.ResponseRecorder {
	t.Helper()
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	w.WriteField("upload_id", id)
	w.WriteField("expected_revision", revision)
	w.WriteField("site_id", "chunkbootstrap1")
	w.Close()
	req := httptest.NewRequest("POST", endpoint, &b)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", token)
	return pushHTTP(t, h, req, status)
}
func cleanupUploads(t *testing.T, app *pocketbase.PocketBase) *importUploads {
	t.Helper()
	m := app.Store().Get(importUploadStoreKey).(*importUploads)
	t.Cleanup(func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		for id := range m.sessions {
			m.remove(id)
		}
	})
	return m
}

func TestChunkedImportAllRoutes(t *testing.T) {
	for _, mode := range []string{"site", "preview", "library", "bootstrap"} {
		t.Run(mode, func(t *testing.T) {
			app := newPushTestApp(t)
			defer app.ResetBootstrapState()
			h, token := pushTestHTTP(t, app)
			m := cleanupUploads(t, app)
			data := zipFiles(t, map[string]string{"site.yaml": "name: Chunked\n", "library/groups.yaml": "[]\n"})
			endpoint := "/api/primo/" + mode
			revision := "absent"
			switch mode {
			case "site", "preview":
				site := createImportTestSite(t, app)
				revision = mustPushState(t, app, site.Id).Revision
				endpoint = "/api/primo/import/" + site.Id
				if mode == "preview" {
					endpoint += "/preview"
				}
			case "library":
				endpoint = "/api/primo/import-library"
				revision = mustPushState(t, app, "library").Revision
			case "bootstrap":
				token = "" // First-run bootstrap remains supported remotely.
			}
			id := chunkStart(t, h, token, endpoint, data)
			half := len(data) / 2
			chunkPut(t, h, token, id, 0, data[:half], 200)
			chunkCommit(t, h, token, endpoint, id, revision, 400) // Incomplete means no import.
			chunkPut(t, h, token, id, 0, data[:half], 200)        // Lost acknowledgement is safe.
			chunkPut(t, h, token, id, half, data[half:], 200)
			chunkCommit(t, h, token, endpoint, id, revision, 200)
			files, _ := os.ReadDir(m.root)
			if len(files) != 0 {
				t.Fatal("consumed archive retained on disk")
			}
			status := 404
			if mode == "bootstrap" {
				status = 403
			}
			chunkCommit(t, h, token, endpoint, id, revision, status)
		})
	}
}

func TestChunkedImportPreservesRevisionGuard(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, entry, data := pushFixture(t, app)
	h, token := pushTestHTTP(t, app)
	cleanupUploads(t, app)
	endpoint := "/api/primo/import/" + site.Id
	before := mustPushState(t, app, site.Id)
	id := chunkStart(t, h, token, endpoint, data)
	chunkPut(t, h, token, id, 0, data, 200)
	if got := mustPushState(t, app, site.Id); got.Revision != before.Revision {
		t.Fatal("staging mutated content")
	}
	entry.Set("value", "Client edit during upload")
	if err := app.Save(entry); err != nil {
		t.Fatal(err)
	}
	current := mustPushState(t, app, site.Id)
	chunkCommit(t, h, token, endpoint, id, before.Revision, 409)
	if got := mustPushState(t, app, site.Id); got.Revision != current.Revision {
		t.Fatal("stale staged import overwrote client content")
	}
}

func TestChunkedImportRejectsCorruptionAndScopeChanges(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	site, _, data := pushFixture(t, app)
	otherID := "anotherchunk001"
	h, token := pushTestHTTP(t, app)
	m := cleanupUploads(t, app)
	endpoint := "/api/primo/import/" + site.Id
	revision := mustPushState(t, app, site.Id).Revision
	id := chunkStart(t, h, token, endpoint, data)
	chunkPut(t, h, token, id, 1, data[:2], 400) // Gap.
	chunkPut(t, h, "", id, 0, data, 404)        // Owner mismatch.
	chunkPut(t, h, token, id, 0, data[:10], 200)
	chunkPut(t, h, token, id, 0, bytes.Repeat([]byte{'x'}, 10), 400) // Different replay.
	chunkPut(t, h, token, id, 5, data[5:15], 400)                    // Partial overlap.
	chunkCommit(t, h, token, "/api/primo/import/"+otherID, id, revision, 404)
	chunkCommit(t, h, token, endpoint+"/preview", id, revision, 404)
	req := httptest.NewRequest("PUT", "/api/primo/import-uploads/"+id+"?offset=10", bytes.NewReader(data[10:]))
	req.Header.Set("Authorization", token)
	req.Header.Set("X-Primo-Chunk-SHA256", strings.Repeat("0", 64))
	pushHTTP(t, h, req, 400)
	chunkPut(t, h, token, id, 10, data[10:], 200)
	// Simulate corrupt on-disk staging; end-to-end digest must fail closed.
	if err := os.WriteFile(m.sessions[id].path, bytes.Repeat([]byte{'x'}, len(data)), 0600); err != nil {
		t.Fatal(err)
	}
	chunkCommit(t, h, token, endpoint, id, revision, 400)
	if got := mustPushState(t, app, site.Id); got.Revision != revision {
		t.Fatal("corrupt upload changed content")
	}
}

func TestChunkedImportPermissionRevocationAndFreshness(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	h, token := pushTestHTTP(t, app)
	cleanupUploads(t, app)
	data := zipFiles(t, map[string]string{"site.yaml": "name: Test\n"})
	id := chunkStart(t, h, "", "/api/primo/bootstrap", data)
	site := createImportTestSite(t, app)
	chunkPut(t, h, "", id, 0, data, 403)
	endpoint := "/api/primo/import/" + site.Id
	id = chunkStart(t, h, token, endpoint, data)
	user, err := app.FindFirstRecordByData("users", "email", "push-test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	user.Set("serverRole", "")
	if err := app.Save(user); err != nil {
		t.Fatal(err)
	}
	chunkPut(t, h, token, id, 0, data, 403)
}

func TestChunkedImportBoundsCancellationAndExpiry(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	h, token := pushTestHTTP(t, app)
	m := cleanupUploads(t, app)
	data := []byte("archive")
	endpoint := "/api/primo/bootstrap"
	first := chunkStart(t, h, token, endpoint, data)
	second := chunkStart(t, h, token, endpoint, data)
	body, _ := json.Marshal(map[string]any{"endpoint": endpoint, "size": len(data), "sha256": chunkHash(data)})
	req := httptest.NewRequest("POST", "/api/primo/import-uploads", bytes.NewReader(body))
	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")
	pushHTTP(t, h, req, 429)
	req = httptest.NewRequest("DELETE", "/api/primo/import-uploads/"+first, nil)
	req.Header.Set("Authorization", token)
	pushHTTP(t, h, req, 204)
	chunkPut(t, h, token, first, 0, data, 404)
	// Exercise the same expiry cleanup with a short timer, including idle cleanup.
	expired := make(chan struct{})
	m.mu.Lock()
	m.sessions[second].timer.Stop()
	m.sessions[second].timer = time.AfterFunc(time.Millisecond, func() { m.mu.Lock(); m.remove(second); m.mu.Unlock(); close(expired) })
	m.mu.Unlock()
	<-expired
	files, _ := os.ReadDir(m.root)
	if len(files) != 0 {
		t.Fatal("expired session left temporary files")
	}
	chunkPut(t, h, token, second, 0, data, 404)
	for _, size := range []int64{0, maxImportRequestBytes + 1} {
		body, _ = json.Marshal(map[string]any{"endpoint": endpoint, "size": size, "sha256": chunkHash(data)})
		req = httptest.NewRequest("POST", "/api/primo/import-uploads", bytes.NewReader(body))
		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")
		pushHTTP(t, h, req, 400)
	}
}

func TestLibraryImportRejectsOversizedExpandedArchive(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	var data bytes.Buffer
	writer := zip.NewWriter(&data)
	entry, err := writer.CreateRaw(&zip.FileHeader{Name: "library/bomb", Method: zip.Store, CompressedSize64: 1, UncompressedSize64: uint64(maxImportUncompressedBytes) + 1})
	if err != nil {
		t.Fatal(err)
	}
	entry.Write([]byte("x"))
	writer.Close()
	before := mustPushState(t, app, "library")
	if _, err := processLibraryImport(app, data.Bytes(), DeletesManifest{}); err == nil || !strings.Contains(err.Error(), "maximum uncompressed size") {
		t.Fatalf("expected bounded archive rejection, got %v", err)
	}
	if after := mustPushState(t, app, "library"); before.Revision != after.Revision {
		t.Fatal("oversized archive changed library")
	}
}
