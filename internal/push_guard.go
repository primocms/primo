package internal

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

const pushRevisionHeader = "X-Primo-Revision"
const absentRevision = "absent"

func pushImportError(e *core.RequestEvent, err error) error {
	var apiError *router.ApiError
	if errors.As(err, &apiError) {
		return err
	}
	return e.InternalServerError("Import failed: "+err.Error(), err)
}

type pushState struct {
	Protocol int    `json:"protocol"`
	Exists   bool   `json:"exists"`
	Revision string `json:"revision"`
}

// Fingerprint stored content, not a parent's updated timestamp: editing a child
// entry, deleting a field, or reordering a section need not update that parent.
// Keep this scope in step with the importers. IDs and sorted records make both
// insertions and deletions visible. Publishing/presence/snapshots aren't inputs.
func readPushState(app core.App, target string) (pushState, error) {
	return readPushStateAndRecords(app, target, nil)
}

func readPushStateAndRecords(app core.App, target string, raw map[string][]map[string]any) (pushState, error) {
	state := pushState{Protocol: 1, Revision: absentRevision}
	scopes := map[string]string{}
	params := dbx.Params{"site": target}
	if target == "library" {
		for _, name := range []string{"library_symbol_groups", "library_symbols", "library_symbol_fields", "library_symbol_entries"} {
			scopes[name] = ""
		}
	} else {
		site, err := app.FindRecordById("sites", target)
		if errors.Is(err, sql.ErrNoRows) {
			return state, nil
		}
		if err != nil {
			return state, err
		}
		state.Exists = true
		params["group"] = site.GetString("group")
		scopes = map[string]string{
			"sites": "id = {:site}", "site_groups": "id = {:group}",
			"site_fields": "site = {:site}", "site_entries": "field.site = {:site}",
			"site_symbols": "site = {:site}", "site_symbol_fields": "symbol.site = {:site}",
			"site_symbol_entries": "field.symbol.site = {:site}",
			"page_types":          "site = {:site}", "page_type_fields": "page_type.site = {:site}",
			"page_type_symbols": "page_type.site = {:site}", "page_type_sections": "page_type.site = {:site}",
			"page_type_section_entries": "section.page_type.site = {:site}",
			"pages":                     "site = {:site}", "page_entries": "page.site = {:site}",
			"page_sections": "page.site = {:site}", "page_section_entries": "section.page.site = {:site}",
			"site_uploads": "site = {:site}",
		}
	}
	data := map[string][]map[string]any{}
	for collection, filter := range scopes {
		records, err := app.FindRecordsByFilter(collection, filter, "id", 0, 0, params)
		if err != nil {
			return state, fmt.Errorf("fingerprint %s: %w", collection, err)
		}
		data[collection] = []map[string]any{}
		if raw != nil {
			raw[collection] = []map[string]any{}
		}
		if target == "library" && len(records) > 0 {
			state.Exists = true
		}
		for _, record := range records {
			if raw != nil {
				raw[collection] = append(raw[collection], record.FieldsData())
			}
			fields := record.FieldsData()
			delete(fields, "updated")
			if collection == "pages" {
				delete(fields, "compiled_html")
			}
			if collection == "sites" {
				for key := range fields {
					if key == "preview" || key == "host" || strings.HasPrefix(key, "domain_") {
						delete(fields, key)
					}
				}
			}
			data[collection] = append(data[collection], fields)
		}
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		return state, err
	}
	sum := sha256.Sum256(encoded)
	state.Revision = "v1:" + hex.EncodeToString(sum[:])
	return state, nil
}

func checkPushRevision(state pushState, expected string) error {
	if expected == "" {
		return apis.NewApiError(428, "Push requires a sync baseline. Update the CLI and pull first, or explicitly force an overwrite with a backup.", nil)
	}
	if expected != state.Revision {
		return apis.NewApiError(409, "Push stopped: server changes were saved since your last sync or confirmation. Nothing was changed by this import.", nil)
	}
	return nil
}

// Backups live outside public file storage. Force never bypasses the revision
// comparison; it authorizes replacement of exactly the state just reviewed.
func savePushBackup(app core.App, target string, state pushState) (string, error) {
	if !state.Exists {
		return "", nil
	}
	var data []byte
	var err error
	if target == "library" {
		data, err = exportLibraryToZip(app)
	} else {
		var site *core.Record
		site, err = app.FindRecordById("sites", target)
		if err == nil {
			data, err = exportSiteToZip(app, site)
		}
	}
	if err != nil {
		return "", fmt.Errorf("could not create overwrite backup: %w", err)
	}
	// Retain the original records too. The portable export is convenient for
	// re-import, but older import formats cannot represent every nested field
	// or shared group property. Keep those values available for recovery.
	records := map[string][]map[string]any{}
	if _, err := readPushStateAndRecords(app, target, records); err != nil {
		return "", err
	}
	metadata, err := json.Marshal(map[string]any{"version": 1, "target": target, "revision": state.Revision, "records": records})
	if err != nil {
		return "", err
	}
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	var augmented bytes.Buffer
	writer := zip.NewWriter(&augmented)
	for _, file := range reader.File {
		if err := writer.Copy(file); err != nil {
			writer.Close()
			return "", err
		}
	}
	entry, err := writer.Create(".primo/backup-records.json")
	if err != nil {
		writer.Close()
		return "", err
	}
	if _, err := entry.Write(metadata); err != nil {
		writer.Close()
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	data = augmented.Bytes()
	dir := filepath.Join(app.DataDir(), "push_backups", target)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	file, err := os.CreateTemp(dir, "backup-*.zip")
	if err != nil {
		return "", err
	}
	name := file.Name()
	_, writeErr := file.Write(data)
	if writeErr == nil {
		writeErr = file.Sync()
	}
	closeErr := file.Close()
	if writeErr == nil {
		writeErr = closeErr
	}
	if writeErr != nil {
		os.Remove(name)
		return "", writeErr
	}
	return filepath.Base(name), nil
}

var pushTargetPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
var pushBackupPattern = regexp.MustCompile(`^backup-[0-9]+\.zip$`)

func authorizePushState(app core.App, e *core.RequestEvent, target string) error {
	if !pushTargetPattern.MatchString(target) {
		return e.BadRequestError("Invalid push target", nil)
	}
	if DevMode && IsLocalhost(e) {
		return nil
	}
	if e.Auth == nil {
		// Allow only an empty-instance preflight for first-time bootstrap.
		sites, err := app.CountRecords("sites")
		if err != nil {
			return err
		}
		library, err := readPushState(app, "library")
		if err != nil {
			return err
		}
		if sites == 0 && !library.Exists {
			return nil
		}
		return e.UnauthorizedError("Authentication required", nil)
	}
	if e.Auth.IsSuperuser() {
		return nil
	}
	if target == "library" {
		if e.Auth.GetString("serverRole") == "developer" {
			return nil
		}
		return e.ForbiddenError("A server developer is required to push the library", nil)
	}
	site, err := app.FindRecordById("sites", target)
	if errors.Is(err, sql.ErrNoRows) {
		if e.Auth.GetString("serverRole") == "developer" {
			return nil
		}
		return e.ForbiddenError("A server developer is required to create a site", nil)
	}
	if err != nil {
		return err
	}
	info, err := e.RequestInfo()
	if err != nil {
		return err
	}
	allowed, err := app.CanAccessRecord(site, info, site.Collection().UpdateRule)
	if err != nil {
		return err
	}
	if !allowed {
		return e.ForbiddenError("Access denied", nil)
	}
	return nil
}

func RegisterPushGuardEndpoints(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(event *core.ServeEvent) error {
		event.Router.GET("/api/primo/push-state/{target}", func(e *core.RequestEvent) error {
			target := e.Request.PathValue("target")
			var state pushState
			err := pb.RunInTransaction(func(app core.App) error {
				if err := authorizePushState(app, e, target); err != nil {
					return err
				}
				var err error
				state, err = readPushState(app, target)
				return err
			})
			if err != nil {
				return err
			}
			e.Response.Header().Set("Cache-Control", "no-store")
			return e.JSON(200, state)
		})
		event.Router.GET("/api/primo/push-backups/{target}/{backup}", func(e *core.RequestEvent) error {
			target, backup := e.Request.PathValue("target"), e.Request.PathValue("backup")
			if e.Auth == nil && !(DevMode && IsLocalhost(e)) {
				return e.UnauthorizedError("Authentication required", nil)
			}
			if err := authorizePushState(pb, e, target); err != nil {
				return err
			}
			if !pushBackupPattern.MatchString(backup) {
				return e.NotFoundError("Backup not found", nil)
			}
			data, err := os.ReadFile(filepath.Join(pb.DataDir(), "push_backups", target, backup))
			if err != nil {
				return e.NotFoundError("Backup not found", err)
			}
			e.Response.Header().Set("Content-Type", "application/zip")
			e.Response.Header().Set("Content-Disposition", `attachment; filename="`+backup+`"`)
			e.Response.Header().Set("Cache-Control", "no-store")
			_, err = e.Response.Write(data)
			return err
		})
		return event.Next()
	})
	return nil
}
