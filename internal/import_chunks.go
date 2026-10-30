package internal

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const importChunkBytes int64 = 4 << 20
const importUploadTTL = time.Hour
const importUploadStoreKey = "primo.importUploads.v1"

// Staging changes no records or live files. The final import still performs its
// normal authorization, revision check, validation and transaction. Sessions
// belong to one principal and exact endpoint; their random IDs are capabilities
// for the unauthenticated fresh-instance bootstrap path.
type importUpload struct {
	owner, endpoint, path, digest string
	size, received                int64
	timer                         *time.Timer
}
type importUploads struct {
	mu       sync.Mutex
	root     string
	sessions map[string]*importUpload
}

func uploadOwner(e *core.RequestEvent) string {
	if e.Auth == nil {
		return "anonymous"
	}
	return e.Auth.Collection().Id + ":" + e.Auth.Id
}

func authorizeImportUpload(app core.App, e *core.RequestEvent, endpoint string) error {
	switch endpoint {
	case "/api/primo/bootstrap":
		if e.Auth != nil && !isSiteDeveloper(app, e.Auth, "") {
			return e.ForbiddenError("A server developer is required to bootstrap a workspace", nil)
		}
		if !(DevMode && IsLocalhost(e)) {
			count, err := app.CountRecords("sites")
			if err != nil {
				return err
			}
			if count > 0 {
				return e.ForbiddenError("Bootstrap not allowed - sites already exist", nil)
			}
		}
		return nil
	case "/api/primo/import-library":
		return authorizePushState(app, e, "library")
	default:
		target := strings.TrimPrefix(endpoint, "/api/primo/import/")
		target = strings.TrimSuffix(target, "/preview")
		if endpoint != "/api/primo/import/"+target && endpoint != "/api/primo/import/"+target+"/preview" {
			return e.BadRequestError("Invalid import endpoint", nil)
		}
		if target == "library" || !pushTargetPattern.MatchString(target) {
			return e.BadRequestError("Invalid import target", nil)
		}
		if e.Auth == nil && !(DevMode && IsLocalhost(e)) {
			return e.UnauthorizedError("Authentication required", nil)
		}
		return authorizePushStateWithInfo(app, e, target, &core.RequestInfo{
			Auth: e.Auth, Method: http.MethodPost, Body: map[string]any{}, Query: map[string]string{}, Headers: map[string]string{},
		})
	}
}

// Called once with the import route registration. Private staging is disposable
// across restarts; TTL timers also remove abandoned sessions on an idle server.
func registerImportUploads(pb *pocketbase.PocketBase) error {
	m := &importUploads{sessions: make(map[string]*importUpload)}
	pb.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		m.mu.Lock()
		for id := range m.sessions {
			m.remove(id)
		}
		m.mu.Unlock()
		return e.Next()
	})
	pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// Commands such as --version and migrate must not clear a running server's
		// staging. Initialize only when this process actually starts serving.
		m.root = filepath.Join(pb.DataDir(), ".import-uploads")
		if err := os.RemoveAll(m.root); err != nil {
			return err
		}
		if err := os.MkdirAll(m.root, 0700); err != nil {
			return err
		}
		pb.Store().Set(importUploadStoreKey, m)
		e.Router.POST("/api/primo/import-uploads", m.create).Bind(apis.BodyLimit(4096))
		e.Router.PUT("/api/primo/import-uploads/{upload}", m.append).Bind(apis.BodyLimit(importChunkBytes))
		e.Router.DELETE("/api/primo/import-uploads/{upload}", m.cancel).Bind(apis.BodyLimit(4096))
		return e.Next()
	})
	return nil
}

// Caller holds mu. Reserving declared sizes caps total disk use, including
// anonymous bootstrap uploads, at 1 GiB and two sessions per principal.
func (m *importUploads) remove(id string) {
	if u := m.sessions[id]; u != nil {
		if u.timer != nil {
			u.timer.Stop()
		}
		os.Remove(u.path)
		delete(m.sessions, id)
	}
}
func (m *importUploads) create(e *core.RequestEvent) error {
	var request struct {
		Endpoint string `json:"endpoint"`
		Size     int64  `json:"size"`
		SHA256   string `json:"sha256"`
	}
	if err := e.BindBody(&request); err != nil {
		return e.BadRequestError("Invalid upload metadata", err)
	}
	digest, err := hex.DecodeString(request.SHA256)
	if request.Size <= 0 || request.Size > maxImportRequestBytes || err != nil || len(digest) != sha256.Size {
		return e.BadRequestError("Archive must be at most 512 MiB and include its SHA-256", nil)
	}
	if err := authorizeImportUpload(e.App, e, request.Endpoint); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	var reserved int64
	var owned int
	owner := uploadOwner(e)
	for _, u := range m.sessions {
		reserved += u.size
		if u.owner == owner {
			owned++
		}
	}
	if len(m.sessions) >= 8 || owned >= 2 || reserved+request.Size > 1<<30 {
		return e.TooManyRequestsError("Too many staged imports; finish or cancel an upload before retrying", nil)
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return err
	}
	id := hex.EncodeToString(key)
	file, err := os.CreateTemp(m.root, "archive-")
	if err != nil {
		return err
	}
	file.Close()
	u := &importUpload{owner: owner, endpoint: request.Endpoint, path: file.Name(), size: request.Size, digest: strings.ToLower(request.SHA256)}
	m.sessions[id] = u
	u.timer = time.AfterFunc(importUploadTTL, func() { m.mu.Lock(); defer m.mu.Unlock(); m.remove(id) })
	e.Response.Header().Set("Cache-Control", "no-store")
	return e.JSON(201, map[string]any{"protocol": 1, "upload_id": id, "chunk_bytes": importChunkBytes})
}

func (m *importUploads) append(e *core.RequestEvent) error {
	id := e.Request.PathValue("upload")
	offset, err := strconv.ParseInt(e.Request.URL.Query().Get("offset"), 10, 64)
	if err != nil || offset < 0 {
		return e.BadRequestError("Invalid chunk offset", nil)
	}
	// Check authorization before reading a body, then recheck identity after the
	// read in case a cancellation or expiry happened while bytes were in flight.
	m.mu.Lock()
	u := m.sessions[id]
	if u == nil || u.owner != uploadOwner(e) {
		m.mu.Unlock()
		return e.NotFoundError("Upload not found or expired", nil)
	}
	endpoint := u.endpoint
	m.mu.Unlock()
	if err := authorizeImportUpload(e.App, e, endpoint); err != nil {
		return err
	}
	data, err := io.ReadAll(io.LimitReader(e.Request.Body, importChunkBytes+1))
	if err != nil {
		return e.BadRequestError("Failed to read chunk", err)
	}
	if len(data) == 0 || int64(len(data)) > importChunkBytes {
		return e.BadRequestError("Invalid chunk size", nil)
	}
	sum := sha256.Sum256(data)
	if hex.EncodeToString(sum[:]) != e.Request.Header.Get("X-Primo-Chunk-SHA256") {
		return e.BadRequestError("Chunk checksum mismatch", nil)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sessions[id] != u {
		return e.NotFoundError("Upload not found or expired", nil)
	}
	end := offset + int64(len(data))
	if offset > u.received || end > u.size {
		return e.BadRequestError("Chunk is outside the expected archive range", nil)
	}
	f, err := os.OpenFile(u.path, os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	if offset < u.received {
		// A lost response may replay an acknowledged chunk. Only identical bytes
		// wholly within the committed prefix are idempotent; overlaps reject.
		if end > u.received {
			return e.BadRequestError("Chunk overlaps an incomplete range", nil)
		}
		previous := make([]byte, len(data))
		if _, err := f.ReadAt(previous, offset); err != nil {
			return err
		}
		if !bytes.Equal(previous, data) {
			return e.BadRequestError("Retried chunk differs from staged bytes", nil)
		}
	} else {
		if _, err := f.WriteAt(data, offset); err != nil {
			return err
		}
		u.received = end
	}
	return e.JSON(200, map[string]any{"received": u.received})
}

func (m *importUploads) cancel(e *core.RequestEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := e.Request.PathValue("upload")
	if u := m.sessions[id]; u != nil && u.owner != uploadOwner(e) {
		return e.NotFoundError("Upload not found", nil)
	}
	m.remove(id)
	return e.NoContent(http.StatusNoContent)
}

// Both legacy multipart archives and staged references feed the same importer.
// A staged archive is single-use, even if final validation rejects it. Retrying
// the final POST automatically would risk applying an import twice.
func readImportArchive(app core.App, e *core.RequestEvent, optional bool) ([]byte, error) {
	id := e.Request.FormValue("upload_id")
	if id == "" {
		f, _, err := e.Request.FormFile("file")
		if optional && errors.Is(err, http.ErrMissingFile) {
			return nil, nil
		}
		if err != nil {
			return nil, e.BadRequestError("No file uploaded", err)
		}
		defer f.Close()
		data, err := io.ReadAll(io.LimitReader(f, maxImportRequestBytes+1))
		if int64(len(data)) > maxImportRequestBytes {
			return nil, e.BadRequestError("Archive exceeds 512 MiB", nil)
		}
		return data, err
	}
	if e.Request.MultipartForm != nil && len(e.Request.MultipartForm.File["file"]) > 0 {
		return nil, e.BadRequestError("Send file or upload_id, not both", nil)
	}
	m, ok := app.Store().Get(importUploadStoreKey).(*importUploads)
	if !ok {
		return nil, e.BadRequestError("Batched imports unavailable", nil)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	u := m.sessions[id]
	if u == nil || u.owner != uploadOwner(e) || u.endpoint != e.Request.URL.Path {
		return nil, e.NotFoundError("Upload not found for this caller and endpoint", nil)
	}
	if err := authorizeImportUpload(app, e, u.endpoint); err != nil {
		return nil, err
	}
	if u.received != u.size {
		return nil, e.BadRequestError("Archive upload is incomplete", nil)
	}
	defer m.remove(id)
	data, err := os.ReadFile(u.path)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(data)
	if int64(len(data)) != u.size || hex.EncodeToString(sum[:]) != u.digest {
		return nil, e.BadRequestError("Archive checksum mismatch", nil)
	}
	return data, nil
}
