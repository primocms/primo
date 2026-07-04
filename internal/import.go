package internal

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"golang.org/x/net/html"
	"gopkg.in/yaml.v3"
)

// Helper to get file data from the files map
func getFileData(files map[string][]byte, path string) []byte {
	if data, ok := files[path]; ok {
		return data
	}
	return nil
}

func getExportedID(data map[string]interface{}) string {
	if id, ok := data["_id"].(string); ok && id != "" {
		return id
	}
	if id, ok := data["id"].(string); ok && id != "" {
		return id
	}
	return ""
}

// parseBareFieldList unmarshals a fields.yaml file. Block, page-type, and
// site fields.yaml files are canonical bare top-level lists; wrapper objects
// such as `{ fields: [...] }` are rejected so the importer and validators stay
// consistent.
func parseBareFieldList(data []byte, filePath string) ([]interface{}, error) {
	if len(data) == 0 {
		return nil, nil
	}

	var document interface{}
	if err := yaml.Unmarshal(data, &document); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", filePath, err)
	}

	switch value := document.(type) {
	case nil:
		return nil, nil
	case []interface{}:
		return value, nil
	case map[string]interface{}:
		return nil, fmt.Errorf("%s must be a bare list of field definitions, but it's a map. Remove any top-level wrapper such as `fields:` and start the file with `- name: ...`.", filePath)
	default:
		return nil, fmt.Errorf("%s must be a bare list of field definitions.", filePath)
	}
}

func fieldListToMaps(fieldEntries []interface{}) []map[string]interface{} {
	fields := make([]map[string]interface{}, 0, len(fieldEntries))
	for _, fieldEntry := range fieldEntries {
		if fieldData, ok := fieldEntry.(map[string]interface{}); ok {
			fields = append(fields, fieldData)
		}
	}
	return fields
}

func rejectLegacyPageTypeID(data []byte, filePath string) error {
	var document map[string]interface{}
	if err := yaml.Unmarshal(data, &document); err != nil {
		return fmt.Errorf("failed to parse %s: %w", filePath, err)
	}

	if _, ok := document["id"]; ok {
		return fmt.Errorf("%s contains unsupported property `id`; use `_id` for page type configs", filePath)
	}

	return nil
}

func parseContentMap(data []byte, isYaml bool) (map[string]interface{}, error) {
	var content map[string]interface{}
	var err error
	if isYaml {
		err = yaml.Unmarshal(data, &content)
	} else {
		err = json.Unmarshal(data, &content)
	}
	return content, err
}

func normalizeImportedFieldConfig(value interface{}) (interface{}, bool) {
	if value == nil {
		return nil, false
	}

	if str, ok := value.(string); ok {
		if strings.TrimSpace(str) == "" {
			return nil, false
		}
	}

	return value, true
}

// buildBlockFieldCompositeKey constructs a composite key by walking up the parent chain
func buildBlockFieldCompositeKey(field *core.Record, byID map[string]*core.Record) string {
	key := field.GetString("key")
	if key == "" {
		return ""
	}

	parts := []string{key}
	current := field
	seen := map[string]bool{field.Id: true}

	for {
		parentID := current.GetString("parent")
		if parentID == "" || seen[parentID] {
			break
		}
		parent := byID[parentID]
		if parent == nil {
			break
		}

		parentKey := parent.GetString("key")
		if parentKey == "" {
			break
		}

		parts = append([]string{parentKey}, parts...)
		seen[parentID] = true
		current = parent
	}

	return strings.Join(parts, "/")
}

// ImportDiff represents changes that would be made
type ImportDiff struct {
	Blocks    ImportDiffSection `json:"blocks"`
	PageTypes ImportDiffSection `json:"page_types"`
	Pages     ImportDiffSection `json:"pages"`
	Site      ImportDiffSection `json:"site"`
}

type ImportDiffSection struct {
	Added    []string `json:"added"`
	Modified []string `json:"modified"`
	Deleted  []string `json:"deleted"`
}

// ImportWarning describes a non-fatal problem encountered during import —
// most commonly, content in a source file that doesn't match the current
// block/page schema (an "orphaned" field). The CLI surfaces these to the user
// so that silently-dropped content becomes a loud, actionable error.
type ImportWarning struct {
	Kind    string `json:"kind"`    // e.g. "orphaned_field"
	File    string `json:"file"`    // source file path, e.g. "pages/index.yaml"
	Path    string `json:"path"`    // dotted path to the offending field, e.g. "sections[2].content.categories"
	Field   string `json:"field"`   // the unknown field key
	Block   string `json:"block"`   // block/symbol name when relevant
	Message string `json:"message"` // human-readable explanation
}

// ImportResult contains the diff and created IDs for writing back to files
type ImportResult struct {
	Diff       *ImportDiff                       `json:"diff"`
	CreatedIDs map[string]map[string]interface{} `json:"created_ids"`
	Warnings   []ImportWarning                   `json:"warnings,omitempty"`
}

func RegisterImportEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		// Preview endpoint - shows what would change
		serveEvent.Router.POST("/api/primo/import/{siteId}/preview", func(e *core.RequestEvent) error {
			return handleImport(pb, e, true)
		})

		// Apply endpoint - actually makes changes
		serveEvent.Router.POST("/api/primo/import/{siteId}", func(e *core.RequestEvent) error {
			return handleImport(pb, e, false)
		})

		// Incremental upload endpoints. These let the CLI push binaries out of
		// band, one small request each, instead of stuffing every upload into
		// the import zip — which made large-media sites blow past the hosting
		// proxy's request timeout on a single synchronous /import call.
		//
		// check: given a list of content hashes the client holds, return which
		// ones the server is missing, so the client only sends new/changed bytes.
		serveEvent.Router.POST("/api/primo/uploads/{siteId}/check", func(e *core.RequestEvent) error {
			return handleUploadsCheck(pb, e)
		})
		// put: ingest a single upload (create or replace-in-place), returning
		// its record id, canonical filename, and hash for CLI writeback.
		serveEvent.Router.POST("/api/primo/uploads/{siteId}/put", func(e *core.RequestEvent) error {
			return handleUploadPut(pb, e)
		})

		return serveEvent.Next()
	})
	return nil
}

// resolveImportSite finds the target site and enforces the same auth/access
// rules handleImport uses: localhost is trusted (local dev), otherwise the
// caller must be authenticated and pass PocketBase's per-record update rule.
// Unlike import, these endpoints never create a site — an upload to a
// nonexistent site is a 404, since the site must exist before its media can.
func resolveImportSite(pb *pocketbase.PocketBase, e *core.RequestEvent) (*core.Record, error) {
	siteId := e.Request.PathValue("siteId")
	if siteId == "" {
		return nil, e.BadRequestError("Missing site ID", nil)
	}
	if e.Auth == nil && !IsLocalhost(e) {
		return nil, e.UnauthorizedError("Authentication required", nil)
	}
	site, err := pb.FindRecordById("sites", siteId)
	if err != nil {
		return nil, e.NotFoundError("Site not found", err)
	}
	if !IsLocalhost(e) {
		info, err := e.RequestInfo()
		if err != nil {
			return nil, e.InternalServerError("Failed to get request info", err)
		}
		canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
		if !canAccess {
			return nil, e.ForbiddenError("Access denied", nil)
		}
	}
	return site, nil
}

// siteUploadHashes returns filename -> hex sha256 for every stored upload on a
// site, reading each file's bytes once. Used by the check endpoint to decide
// which incoming hashes are already present.
func siteUploadHashes(pb *pocketbase.PocketBase, site *core.Record) (map[string]string, error) {
	recs, err := pb.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch site_uploads: %w", err)
	}
	uploadsColl, err := pb.FindCollectionByNameOrId("site_uploads")
	if err != nil {
		return nil, fmt.Errorf("failed to find site_uploads collection: %w", err)
	}
	fsys, err := pb.NewFilesystem()
	if err != nil {
		return nil, fmt.Errorf("failed to open filesystem: %w", err)
	}
	defer fsys.Close()

	out := make(map[string]string, len(recs))
	for _, rec := range recs {
		fn := rec.GetString("file")
		if fn == "" {
			continue
		}
		reader, readErr := fsys.GetFile(uploadsColl.Id + "/" + rec.Id + "/" + fn)
		if readErr != nil {
			continue
		}
		b, _ := io.ReadAll(reader)
		reader.Close()
		sum := sha256.Sum256(b)
		out[fn] = hex.EncodeToString(sum[:])
	}
	return out, nil
}

// handleUploadsCheck reports which of the client's content hashes the server
// does not already have stored, so the client can upload only the missing set.
// Request body: {"hashes": ["<hex sha256>", ...]}
// Response:     {"missing": ["<hex sha256>", ...]}  (subset of the input)
func handleUploadsCheck(pb *pocketbase.PocketBase, e *core.RequestEvent) error {
	site, err := resolveImportSite(pb, e)
	if err != nil {
		return err
	}

	var body struct {
		Hashes []string `json:"hashes"`
	}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Invalid request body", err)
	}

	have, err := siteUploadHashes(pb, site)
	if err != nil {
		return e.InternalServerError("Failed to read uploads", err)
	}
	present := make(map[string]struct{}, len(have))
	for _, h := range have {
		present[h] = struct{}{}
	}

	missing := make([]string, 0)
	seen := make(map[string]struct{}, len(body.Hashes))
	for _, h := range body.Hashes {
		if _, dup := seen[h]; dup {
			continue
		}
		seen[h] = struct{}{}
		if _, ok := present[h]; !ok {
			missing = append(missing, h)
		}
	}

	return e.JSON(200, map[string]interface{}{"missing": missing})
}

// handleUploadPut ingests a single upload binary and creates or replaces the
// matching site_uploads record. The file is sent as multipart form field
// "file"; the client's intended filename is taken from the form field
// "filename" (falling back to the multipart part's own name) so symbolic
// yaml refs resolve regardless of any PocketBase suffixing.
// Response: {"id", "canonical", "hash", "changed"}
func handleUploadPut(pb *pocketbase.PocketBase, e *core.RequestEvent) error {
	site, err := resolveImportSite(pb, e)
	if err != nil {
		return err
	}

	if err := e.Request.ParseMultipartForm(32 << 20); err != nil { // 32MB per file
		return e.BadRequestError("Failed to parse form", err)
	}
	file, header, err := e.Request.FormFile("file")
	if err != nil {
		return e.BadRequestError("No file uploaded", err)
	}
	defer file.Close()

	filename := strings.TrimSpace(e.Request.FormValue("filename"))
	if filename == "" && header != nil {
		filename = header.Filename
	}
	// Guard against path traversal / nested names — uploads are a flat set
	// keyed by bare filename, mirroring the zip-import filter.
	if filename == "" || strings.HasPrefix(filename, ".") || strings.Contains(filename, "/") {
		return e.BadRequestError("Invalid filename", nil)
	}

	data, err := io.ReadAll(file)
	if err != nil {
		return e.InternalServerError("Failed to read file", err)
	}

	// Resolve any existing record by filename so we replace in place (stable id).
	existing, _ := pb.FindFirstRecordByFilter(
		"site_uploads",
		"site = {:site} && file = {:file}",
		dbx.Params{"site": site.Id, "file": filename},
	)

	entry, changed, err := upsertSiteUpload(pb, site, filename, data, existing, nil, nil)
	if err != nil {
		return e.InternalServerError("Failed to store upload: "+err.Error(), err)
	}

	return e.JSON(200, map[string]interface{}{
		"id":        entry.ID,
		"canonical": entry.Canonical,
		"hash":      entry.Hash,
		"changed":   changed,
	})
}

func handleImport(pb *pocketbase.PocketBase, e *core.RequestEvent, previewOnly bool) error {
	siteId := e.Request.PathValue("siteId")
	if siteId == "" {
		return e.BadRequestError("Missing site ID", nil)
	}

	// Skip auth check for localhost (local dev mode)
	if e.Auth == nil && !IsLocalhost(e) {
		return e.UnauthorizedError("Authentication required", nil)
	}

	// Parse multipart form (must read body before any access checks so we can
	// peek at site.yaml when creating a new site).
	if err := e.Request.ParseMultipartForm(32 << 20); err != nil { // 32MB max
		return e.BadRequestError("Failed to parse form", err)
	}

	file, _, err := e.Request.FormFile("file")
	if err != nil {
		return e.BadRequestError("No file uploaded", err)
	}
	defer file.Close()

	// Read ZIP data
	zipData, err := io.ReadAll(file)
	if err != nil {
		return e.InternalServerError("Failed to read file", err)
	}

	// Pull name/group from site.yaml in the zip. These populate required
	// fields on create and keep the server-side record's name/group in sync
	// with the canonical config on subsequent pushes. Host is intentionally
	// not read from site.yaml — it's deploy-target config (set in the
	// dashboard or by bootstrap), and a file→CMS push must never overwrite
	// the routing host out from under the user.
	siteName, siteGroup := readSiteConfigFromZip(zipData)
	// site.yaml only stores the group ID. The CLI sends the group's display
	// name out-of-band (from workspace server.yaml) so first-time pushes of
	// a new group land with the right label instead of a humanized ID.
	siteGroupName := strings.TrimSpace(e.Request.FormValue("group_name"))

	// Find the site or create it if it doesn't exist
	siteCreated := false
	site, err := pb.FindRecordById("sites", siteId)
	if err != nil {
		createName := siteName
		if createName == "" {
			createName = "Imported Site"
		}
		// Auto-create needs a unique non-empty host because the sites
		// collection has a UNIQUE constraint on `host`. Seed with siteId;
		// real routing hosts arrive separately (bootstrap form field in
		// dev, or dashboard config in prod).
		createHost := siteId

		groupId, groupErr := ensureDefaultGroup(pb)
		if groupErr != nil {
			return e.InternalServerError("Failed to ensure default site group", groupErr)
		}
		if siteGroup != "" {
			if resolvedGroupId, resolveErr := ensureBootstrapGroup(pb, bootstrapSiteGroup{ID: siteGroup, Name: siteGroupName}); resolveErr == nil {
				groupId = resolvedGroupId
			}
		}

		sitesColl, collErr := pb.FindCollectionByNameOrId("sites")
		if collErr != nil {
			return e.InternalServerError("Failed to find sites collection", collErr)
		}

		site = core.NewRecord(sitesColl)
		site.Set("id", siteId)
		site.Set("owner", e.Auth.Id)
		site.Set("name", createName)
		site.Set("host", createHost)
		site.Set("group", groupId)

		if saveErr := pb.Save(site); saveErr != nil {
			return e.InternalServerError("Failed to create site", saveErr)
		}
		siteCreated = true
	}

	// Only check access if site already existed (skip for newly created sites and localhost)
	if !siteCreated && !IsLocalhost(e) {
		info, err := e.RequestInfo()
		if err != nil {
			return e.InternalServerError("Failed to get request info", err)
		}
		canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
		if !canAccess {
			return e.ForbiddenError("Access denied", nil)
		}
	}

	// Sync name/group from site.yaml onto an existing site. Skipped on
	// create (the values were just written above) and during preview (no
	// writes). Empty fields in site.yaml leave the existing record untouched
	// so users editing those values in the dashboard aren't reverted. Host
	// is deliberately excluded: see the comment above readSiteConfigFromZip.
	if !siteCreated && !previewOnly {
		dirty := false
		if siteName != "" && site.GetString("name") != siteName {
			site.Set("name", siteName)
			dirty = true
		}
		if siteGroup != "" {
			resolvedGroupId, resolveErr := ensureBootstrapGroup(pb, bootstrapSiteGroup{ID: siteGroup, Name: siteGroupName})
			if resolveErr == nil && site.GetString("group") != resolvedGroupId {
				site.Set("group", resolvedGroupId)
				dirty = true
			}
		}
		if dirty {
			if saveErr := pb.Save(site); saveErr != nil {
				return e.InternalServerError("Failed to update site", saveErr)
			}
		}
	}

	// Parse and process the import
	result, err := processImport(pb, site, zipData, previewOnly)
	if err != nil {
		return e.InternalServerError("Import failed: "+err.Error(), err)
	}

	if previewOnly {
		return e.JSON(200, map[string]interface{}{
			"preview": true,
			"diff":    result.Diff,
		})
	}

	// In dev mode, track file changes and broadcast status
	if DevMode {
		// Track changed files
		for _, f := range result.Diff.Blocks.Added {
			AddFileChange("blocks/"+f, "push")
		}
		for _, f := range result.Diff.Blocks.Modified {
			AddFileChange("blocks/"+f, "push")
		}
		for _, f := range result.Diff.PageTypes.Added {
			AddFileChange("page-types/"+f, "push")
		}
		for _, f := range result.Diff.PageTypes.Modified {
			AddFileChange("page-types/"+f, "push")
		}
		for _, f := range result.Diff.Pages.Added {
			AddFileChange("pages/"+f, "push")
		}
		for _, f := range result.Diff.Pages.Modified {
			AddFileChange("pages/"+f, "push")
		}
		for _, f := range result.Diff.Site.Modified {
			AddFileChange("site/"+f, "push")
		}

		// Broadcast connected status with updated file list
		BroadcastStatus("connected", "")
	}

	return e.JSON(200, map[string]interface{}{
		"success":     true,
		"diff":        result.Diff,
		"created_ids": result.CreatedIDs,
		"warnings":    result.Warnings,
	})
}

// readSiteConfigFromZip extracts site.yaml from the import zip and returns
// (name, group). Missing or unparseable site.yaml yields empty strings;
// callers fall back to safe defaults so a malformed config never blocks the
// site auto-create path. Host is intentionally not read — it's deploy-target
// config managed by the dashboard/bootstrap, not by file→CMS push.
func readSiteConfigFromZip(zipData []byte) (string, string) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return "", ""
	}
	for _, f := range reader.File {
		if f.Name != "site.yaml" || f.FileInfo().IsDir() {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", ""
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return "", ""
		}
		var cfg struct {
			Name  string `yaml:"name"`
			Group string `yaml:"group"`
		}
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return "", ""
		}
		return cfg.Name, cfg.Group
	}
	return "", ""
}

func processImport(pb *pocketbase.PocketBase, site *core.Record, zipData []byte, previewOnly bool) (*ImportResult, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid ZIP file: %w", err)
	}

	// Parse all files from ZIP
	files := make(map[string][]byte)
	for _, f := range reader.File {
		if f.FileInfo().IsDir() {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		files[f.Name] = data
	}

	// Collects non-fatal import problems (orphaned fields, etc.) to surface
	// back to the CLI so they're impossible to miss instead of silently dropped.
	var warnings []ImportWarning

	// Track created IDs for writing back to files
	createdIDs := make(map[string]map[string]interface{})

	// Reconcile uploads before any content is imported, so the filename->id
	// map is available when blocks/pages reference `upload: "uploads/foo.jpg"`.
	// Skipped in preview mode (no writes) — symbolic refs in a preview just
	// fall through unchanged, which is fine since previews aren't persisted.
	var uploadMap map[string]uploadReconcileEntry
	if !previewOnly {
		um, err := reconcileSiteUploads(pb, site, files, &warnings)
		if err != nil {
			return nil, fmt.Errorf("failed to reconcile uploads: %w", err)
		}
		uploadMap = um

		// Surface upload changes to the CLI under a non-standard key inside
		// the manifest entry. write_created_ids on the CLI inspects this to
		// rename local files to their canonical (PocketBase-suffixed) names
		// and to rewrite any lingering `upload: "uploads/..."` symbolic refs
		// to record IDs. Only entries whose canonical name differs from the
		// symbolic name need a rename, but we surface all of them so the
		// CLI can also reconcile yaml content rewrites.
		if len(uploadMap) > 0 {
			uploadsManifest := make(map[string]interface{}, len(uploadMap))
			for symbolic, entry := range uploadMap {
				m := map[string]interface{}{
					"id":        entry.ID,
					"canonical": entry.Canonical,
				}
				// hash lets a later push skip re-sending unchanged bytes
				// entirely (the CLI compares local file hashes against this
				// before uploading). Empty for records we didn't re-read
				// (e.g. dashboard uploads) — the CLI treats missing as
				// "unknown" and sends the file.
				if entry.Hash != "" {
					m["hash"] = entry.Hash
				}
				uploadsManifest[symbolic] = m
			}
			createdIDs["uploads/.manifest.json"] = map[string]interface{}{
				"_uploads": uploadsManifest,
			}
		}

		// Rewrite symbolic upload paths once, in the parsed yaml file bytes,
		// so downstream importers can keep treating image values as opaque
		// maps. Skipped for files that don't even mention `uploads/` to
		// avoid pointlessly re-marshaling (and renormalizing whitespace in)
		// every yaml file in the zip. Files that fail to parse here are
		// left untouched and will produce the same error they would have
		// anyway when the dedicated importer reaches them.
		for path, data := range files {
			if !strings.HasSuffix(path, ".yaml") {
				continue
			}
			if !bytes.Contains(data, []byte("uploads/")) {
				continue
			}
			var parsed interface{}
			if err := yaml.Unmarshal(data, &parsed); err != nil {
				continue
			}
			rewritten := rewriteUploadRefs(parsed, uploadMap)
			out, err := yaml.Marshal(rewritten)
			if err != nil {
				continue
			}
			files[path] = out
		}
	}

	diff := &ImportDiff{
		Blocks:    ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
		PageTypes: ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
		Pages:     ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
		Site:      ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
	}

	siteId := site.Id

	// Get existing data for comparison
	existingSymbols, _ := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	existingSymbolsByName := make(map[string]*core.Record)
	existingSymbolsById := make(map[string]*core.Record)
	for _, s := range existingSymbols {
		existingSymbolsByName[s.GetString("name")] = s
		existingSymbolsById[s.Id] = s
	}

	// Build slug to page ID map for converting URLs to page references
	pathToPageId, err := buildPagePathMap(pb, siteId)
	if err != nil {
		return nil, fmt.Errorf("failed to build page slug map: %w", err)
	}

	// Import site fields FIRST so we can resolve site-field references in blocks
	siteFieldKeyToId := make(map[string]string)
	if siteFieldsData, ok := files["site/fields.yaml"]; ok {
		if !previewOnly {
			var err error
			siteFieldKeyToId, err = importSiteFieldsWithMap(pb, site, siteFieldsData)
			if err != nil {
				return nil, fmt.Errorf("failed to import site fields: %w", err)
			}
		}
	}

	// Build page type name -> ID map for resolving page-list / page references.
	// First ensure each page-type record exists so the complete map is
	// available while importing blocks. The full page-type import runs after
	// blocks, because allowed_blocks and layout.yaml can reference blocks that
	// are new in the same ZIP.
	pageTypeNameToId := make(map[string]string)
	pageTypeDirs := findDirectories(files, "page-types/")

	// Pass 1: ensure page-type records exist and populate the name -> ID map.
	type ptImportPlan struct {
		ptName     string
		ptData     ExportedPageType
		ptFields   []interface{}
		layoutData *ExportedLayout
		ptHead     *string
		ptFoot     *string
		existing   *core.Record
	}
	plans := make([]ptImportPlan, 0, len(pageTypeDirs))

	for _, ptName := range pageTypeDirs {
		configPath := fmt.Sprintf("page-types/%s/config.yaml", ptName)
		configData := files[configPath]
		if configData == nil {
			continue
		}

		if err := rejectLegacyPageTypeID(configData, configPath); err != nil {
			return nil, err
		}

		var ptData ExportedPageType
		if err := yaml.Unmarshal(configData, &ptData); err != nil {
			continue
		}

		// Read page-level field definitions from sibling fields.yaml.
		fieldsPath := fmt.Sprintf("page-types/%s/fields.yaml", ptName)
		var ptFields []interface{}
		if fieldsBytes, ok := files[fieldsPath]; ok {
			parsed, err := parseBareFieldList(fieldsBytes, fieldsPath)
			if err != nil {
				return nil, err
			}
			ptFields = parsed
		}

		// Read layout.yaml if it exists
		layoutPath := fmt.Sprintf("page-types/%s/layout.yaml", ptName)
		var layoutData *ExportedLayout
		if layoutBytes, ok := files[layoutPath]; ok {
			var layout ExportedLayout
			if err := yaml.Unmarshal(layoutBytes, &layout); err == nil {
				layoutData = &layout
			}
		}

		// Support the legacy layout.yaml location for allowed_blocks.
		if len(ptData.AllowedBlocks) == 0 && layoutData != nil && len(layoutData.AllowedBlocks) > 0 {
			ptData.AllowedBlocks = layoutData.AllowedBlocks
		}

		pageTypeId := ptData.ID

		// Find existing page type by ID, name, or folder.
		var existingPt *core.Record
		if pageTypeId != "" {
			existingPt, _ = pb.FindFirstRecordByFilter("page_types", "site = {:site} && id = {:id}", dbx.Params{"site": siteId, "id": pageTypeId})
		}
		if existingPt == nil {
			existingPt, _ = pb.FindFirstRecordByFilter("page_types", "site = {:site} && name = {:name}", dbx.Params{"site": siteId, "name": ptData.Name})
		}
		if existingPt == nil {
			allPts, _ := pb.FindRecordsByFilter("page_types", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
			for _, candidate := range allPts {
				if sanitizeFilename(candidate.GetString("name")) == ptName {
					existingPt = candidate
					break
				}
			}
		}

		// Ensure the record exists so the name->ID map covers every page type
		// before we translate sibling references in fields below.
		if !previewOnly && existingPt == nil {
			ptColl, err := pb.FindCollectionByNameOrId("page_types")
			if err != nil {
				return nil, fmt.Errorf("failed to find page_types collection: %w", err)
			}
			existingPt = core.NewRecord(ptColl)
			existingPt.Set("site", site.Id)
			existingPt.Set("name", ptData.Name)
			if err := pb.Save(existingPt); err != nil {
				return nil, fmt.Errorf("failed to pre-create page type %s: %w", ptData.Name, err)
			}
		}

		if existingPt != nil {
			pageTypeNameToId[ptName] = existingPt.Id                        // folder name -> ID
			pageTypeNameToId[ptData.Name] = existingPt.Id                   // display name -> ID
			pageTypeNameToId[sanitizeFilename(ptData.Name)] = existingPt.Id // sanitized name -> ID
			if !previewOnly {
				createdIDs[configPath] = map[string]interface{}{
					"_id": existingPt.Id,
				}
			}
		}

		// Optional per-page-type head/foot. Validate the head fragment up front
		// so a bad ZIP fails before we mutate records.
		var ptHead *string
		if headBytes, ok := files[fmt.Sprintf("page-types/%s/head.svelte", ptName)]; ok {
			headPath := fmt.Sprintf("page-types/%s/head.svelte", ptName)
			if err := validateHeadSvelte(headBytes, headPath); err != nil {
				return nil, err
			}
			s := string(headBytes)
			ptHead = &s
		}
		var ptFoot *string
		if footBytes, ok := files[fmt.Sprintf("page-types/%s/foot.html", ptName)]; ok {
			s := string(footBytes)
			ptFoot = &s
		}

		plans = append(plans, ptImportPlan{
			ptName:     ptName,
			ptData:     ptData,
			ptFields:   ptFields,
			layoutData: layoutData,
			ptHead:     ptHead,
			ptFoot:     ptFoot,
			existing:   existingPt,
		})
	}

	// Pre-import page_type_fields rows so blocks can resolve page-field
	// references (compound "<page-type>--<field-key>") to record IDs while
	// they import. The full importPageType still runs in pass 2; calling it
	// here only handles the field rows and is idempotent.
	pageTypeFieldKeyToId := make(map[string]map[string]string) // pt-key (folder/display/sanitized) -> field-key -> field-id
	if !previewOnly {
		for _, plan := range plans {
			if plan.existing == nil {
				continue
			}
			fieldKeyToId, err := importPageTypeFieldsOnly(pb, plan.existing, plan.ptFields, pageTypeNameToId)
			if err != nil {
				return nil, fmt.Errorf("failed to pre-import page type fields for %s: %w", plan.ptData.Name, err)
			}
			pageTypeFieldKeyToId[plan.ptName] = fieldKeyToId
			pageTypeFieldKeyToId[plan.ptData.Name] = fieldKeyToId
			pageTypeFieldKeyToId[sanitizeFilename(plan.ptData.Name)] = fieldKeyToId
		}
	}

	// Process blocks
	blockDirs := findDirectories(files, "blocks/")
	folderToDisplayName := make(map[string]string)
	blockDefaultContent := make(map[string]map[string]interface{})
	for _, blockName := range blockDirs {
		componentPath := fmt.Sprintf("blocks/%s/component.svelte", blockName)
		configPath := fmt.Sprintf("blocks/%s/config.yaml", blockName)
		fieldsPath := fmt.Sprintf("blocks/%s/fields.yaml", blockName)
		contentPathYaml := fmt.Sprintf("blocks/%s/content.yaml", blockName)
		contentPathJson := fmt.Sprintf("blocks/%s/content.json", blockName)

		componentData := files[componentPath]
		configData := files[configPath]
		fieldsData := files[fieldsPath]
		// Prefer YAML, fall back to JSON for backwards compatibility
		contentData := files[contentPathYaml]
		if contentData == nil {
			contentData = files[contentPathJson]
		}
		contentIsYaml := files[contentPathYaml] != nil

		if componentData == nil && fieldsData == nil && configData == nil {
			continue
		}

		var blockFields []interface{}
		if fieldsData != nil {
			parsed, err := parseBareFieldList(fieldsData, fieldsPath)
			if err != nil {
				return nil, err
			}
			blockFields = parsed
		}

		// config.yaml provides the block's display name and stable _id.
		var blockConfig ExportedBlockConfig
		if configData != nil {
			if err := yaml.Unmarshal(configData, &blockConfig); err != nil {
				return nil, fmt.Errorf("failed to parse %s: %w", configPath, err)
			}
		}

		displayName := blockConfig.Name
		if displayName == "" {
			displayName = blockName
		}
		folderToDisplayName[blockName] = displayName

		if contentData != nil {
			if contentMap, err := parseContentMap(contentData, contentIsYaml); err == nil && contentMap != nil {
				blockDefaultContent[blockName] = contentMap
				blockDefaultContent[strings.ToLower(blockName)] = contentMap
				blockDefaultContent[displayName] = contentMap
				blockDefaultContent[sanitizeFilename(displayName)] = contentMap
			}
		}

		existing := existingSymbolsById[blockConfig.ID]
		if existing == nil {
			existing = existingSymbolsByName[displayName]
		}
		if existing == nil {
			// Check by folder name too
			for _, s := range existingSymbols {
				if sanitizeFilename(s.GetString("name")) == blockName {
					existing = s
					break
				}
			}
		}
		// Also check if the symbol ID matches the folder name (for exports that use ID as folder)
		if existing == nil {
			for _, s := range existingSymbols {
				if s.Id == blockName {
					existing = s
					break
				}
			}
		}

		if existing == nil {
			diff.Blocks.Added = append(diff.Blocks.Added, displayName)
		} else {
			// Compare against raw_source when present so the diff matches
			// what export would actually return; fall back to a synthetic
			// reconstruction for symbols imported before raw_source existed.
			var existingCode string
			if raw := existing.GetString("raw_source"); raw != "" {
				existingCode = raw
			} else {
				existingCode = existing.GetString("html") + "\n\n<style>\n" + existing.GetString("css") + "\n</style>"
			}
			if componentData != nil && string(componentData) != existingCode {
				diff.Blocks.Modified = append(diff.Blocks.Modified, displayName)
			}
		}

		if !previewOnly {
			blockId, err := importBlock(pb, site, blockName, displayName, componentData, blockFields, contentData, contentIsYaml, existing, pathToPageId, siteFieldKeyToId, pageTypeNameToId, pageTypeFieldKeyToId, &warnings, fieldsPath)
			if err != nil {
				return nil, fmt.Errorf("failed to import block %s: %w", blockName, err)
			}

			createdIDs[configPath] = map[string]interface{}{
				"_id": blockId,
			}
		}
	}

	// Pass 2: import full page-type contents now that blocks and their fields
	// exist. This lets newly-created blocks immediately satisfy allowed_blocks
	// and layout.yaml, and lets layout-mounted blocks import content/defaults.
	for _, plan := range plans {
		if !previewOnly {
			if err := importPageType(pb, site, plan.ptName, plan.ptData, plan.ptFields, plan.existing, folderToDisplayName, plan.layoutData, plan.ptHead, plan.ptFoot, pageTypeNameToId, blockDefaultContent, &warnings); err != nil {
				return nil, fmt.Errorf("failed to import page type %s: %w", plan.ptData.Name, err)
			}
		}
	}

	// Process page types (for diff tracking - actual import happened earlier)
	pageTypeDirs = findDirectories(files, "page-types/")
	for _, ptName := range pageTypeDirs {
		configPath := fmt.Sprintf("page-types/%s/config.yaml", ptName)
		configData := files[configPath]
		if configData == nil {
			continue
		}

		var ptData ExportedPageType
		if err := yaml.Unmarshal(configData, &ptData); err != nil {
			continue
		}

		// Find existing page type by name or id
		existingPt, _ := pb.FindFirstRecordByFilter("page_types", "site = {:site} && name = {:name}", dbx.Params{"site": siteId, "name": ptData.Name})
		if existingPt == nil {
			// Try by sanitized name
			allPts, _ := pb.FindRecordsByFilter("page_types", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
			for _, candidate := range allPts {
				if sanitizeFilename(candidate.GetString("name")) == ptName {
					existingPt = candidate
					break
				}
			}
		}

		if existingPt == nil {
			diff.PageTypes.Added = append(diff.PageTypes.Added, ptData.Name)
		} else {
			diff.PageTypes.Modified = append(diff.PageTypes.Modified, ptData.Name)
		}
		// Note: actual import happens after blocks so same-ZIP block additions
		// are visible to allowed_blocks and layout.yaml.
	}

	// Process pages - collect and sort by depth to import parents before children
	type pageImportInfo struct {
		path     string
		data     ExportedPage
		existing *core.Record
		depth    int
	}
	var allPages []pageImportInfo

	// Track which paths we've seen to handle both flat and folder patterns
	seenPaths := make(map[string]bool)

	for path, data := range files {
		if !strings.HasPrefix(path, "pages/") {
			continue
		}

		isYaml := strings.HasSuffix(path, ".yaml") || strings.HasSuffix(path, ".yml")
		isJson := strings.HasSuffix(path, ".json")
		if !isYaml && !isJson {
			continue
		}

		var pageData ExportedPage
		var err error
		if isYaml {
			err = yaml.Unmarshal(data, &pageData)
		} else {
			err = json.Unmarshal(data, &pageData)
		}
		if err != nil {
			continue
		}

		pagePath := strings.TrimPrefix(path, "pages/")
		pagePath = strings.TrimSuffix(pagePath, ".yaml")
		pagePath = strings.TrimSuffix(pagePath, ".yml")
		pagePath = strings.TrimSuffix(pagePath, ".json")

		// Handle index.yaml files (both root and nested)
		// pages/index.yaml -> ""
		// pages/about/index.yaml -> "about"
		if strings.HasSuffix(pagePath, "/index") {
			pagePath = strings.TrimSuffix(pagePath, "/index")
		} else if pagePath == "index" {
			pagePath = ""
		}

		// Skip if we've already processed this path (folder pattern takes precedence)
		if seenPaths[pagePath] {
			continue
		}
		seenPaths[pagePath] = true

		// Find existing page by ID first, then by slug, then by name
		// PocketBase uses && and || operators, not SQL-style AND/OR
		existing, _ := pb.FindFirstRecordByFilter("pages", "site = {:site} && id = {:id}", dbx.Params{"site": siteId, "id": pageData.ID})
		if existing == nil && pageData.Slug != "" {
			// Try finding by slug instead (non-empty slug)
			existing, _ = pb.FindFirstRecordByFilter("pages", "site = {:site} && slug = {:slug}", dbx.Params{"site": siteId, "slug": pageData.Slug})
		}
		if existing == nil {
			// Try finding by name as fallback
			existing, _ = pb.FindFirstRecordByFilter("pages", "site = {:site} && name = {:name}", dbx.Params{"site": siteId, "name": pageData.Name})
		}

		if existing == nil {
			diff.Pages.Added = append(diff.Pages.Added, pagePath)
		} else {
			diff.Pages.Modified = append(diff.Pages.Modified, pagePath)
		}

		// Calculate depth based on path separators
		depth := strings.Count(pagePath, "/")

		allPages = append(allPages, pageImportInfo{path: pagePath, data: pageData, existing: existing, depth: depth})
	}

	// Sort pages by depth (parents before children)
	// Homepage (empty slug at root) first, then by depth
	sortedPages := make([]pageImportInfo, 0, len(allPages))
	var homepageInfo *pageImportInfo

	for i := range allPages {
		// Homepage is specifically index.yaml (path == ""), not just any page without a slug
		if allPages[i].path == "" {
			homepageInfo = &allPages[i]
		} else {
			sortedPages = append(sortedPages, allPages[i])
		}
	}

	// Sort by depth
	for i := 0; i < len(sortedPages)-1; i++ {
		for j := i + 1; j < len(sortedPages); j++ {
			if sortedPages[i].depth > sortedPages[j].depth {
				sortedPages[i], sortedPages[j] = sortedPages[j], sortedPages[i]
			}
		}
	}

	// Map to track imported page paths to IDs
	pathToId := make(map[string]string)

	// Import homepage first to get its ID
	var homepageId string
	if homepageInfo != nil && !previewOnly {
		pageId, sectionIds, err := importPage(pb, site, homepageInfo.data, homepageInfo.existing, folderToDisplayName, "", "", &warnings)
		if err != nil {
			return nil, fmt.Errorf("failed to import homepage %s: %w", homepageInfo.path, err)
		}
		homepageId = pageId
		pathToId["index"] = pageId

		// Track created page ID
		createdIDs["pages/index.yaml"] = map[string]interface{}{
			"_id":      pageId,
			"sections": sectionIds,
		}
	}

	// Import pages in order (parents before children)
	for _, info := range sortedPages {
		if !previewOnly {
			parentId := ""

			if strings.Contains(info.path, "/") {
				// This is a nested page (e.g., "blog/getting-started")
				// Find the parent page path (e.g., "blog")
				lastSlash := strings.LastIndex(info.path, "/")
				parentPath := info.path[:lastSlash]

				// Look up the parent page ID. If the parent folder has no
				// own yaml (e.g. pages/blog/ exists but pages/blog.yaml
				// doesn't), skip the page rather than orphan it as a
				// pseudo-homepage with parent="". Cascades: any child of a
				// skipped page is also skipped because it won't find its
				// parent in pathToId either.
				pid, ok := pathToId[parentPath]
				if !ok {
					warnings = append(warnings, ImportWarning{
						Kind:    "orphaned_page",
						File:    "pages/" + info.path + ".yaml",
						Message: fmt.Sprintf("Skipping page %q because its parent folder %q has no %s.yaml or %s/index.yaml", info.path, parentPath, parentPath, parentPath),
					})
					continue
				}
				parentId = pid
			} else {
				// Root-level pages should have homepage as parent
				if homepageId != "" {
					parentId = homepageId
				}
			}

			pageId, sectionIds, err := importPage(pb, site, info.data, info.existing, folderToDisplayName, parentId, info.path, &warnings)
			if err != nil {
				return nil, fmt.Errorf("failed to import page %s: %w", info.path, err)
			}

			// Store the page ID for children to reference
			pathToId[info.path] = pageId

			// Track created page ID
			pagePath := "pages/" + info.path + ".yaml"
			createdIDs[pagePath] = map[string]interface{}{
				"_id":      pageId,
				"sections": sectionIds,
			}
		}
	}

	// Process site config
	if siteFieldsData, ok := files["site/fields.yaml"]; ok {
		diff.Site.Modified = append(diff.Site.Modified, "fields")
		if !previewOnly {
			if err := importSiteFields(pb, site, siteFieldsData); err != nil {
				return nil, fmt.Errorf("failed to import site fields: %w", err)
			}
		}
	}

	// Check for site content (prefer YAML, fall back to JSON)
	siteContentData := files["site/content.yaml"]
	siteContentIsYaml := siteContentData != nil
	if siteContentData == nil {
		siteContentData = files["site/content.json"]
	}
	if siteContentData != nil {
		diff.Site.Modified = append(diff.Site.Modified, "content")
		if !previewOnly {
			// Build slug map for converting URL links to page references
			pathToPageId, err := buildPagePathMap(pb, siteId)
			if err != nil {
				return nil, fmt.Errorf("failed to build page slug map: %w", err)
			}
			if err := importSiteContent(pb, site, siteContentData, siteContentIsYaml, pathToPageId); err != nil {
				return nil, fmt.Errorf("failed to import site content: %w", err)
			}
		}
	}

	if headHtml, ok := files["site/head.svelte"]; ok {
		if err := validateHeadSvelte(headHtml, "site/head.svelte"); err != nil {
			return nil, err
		}
		if string(headHtml) != site.GetString("head") {
			diff.Site.Modified = append(diff.Site.Modified, "head.svelte")
			if !previewOnly {
				site.Set("head", string(headHtml))
				if err := pb.Save(site); err != nil {
					return nil, err
				}
			}
		}
	}

	if footHtml, ok := files["site/foot.html"]; ok {
		if string(footHtml) != site.GetString("foot") {
			diff.Site.Modified = append(diff.Site.Modified, "foot.html")
			if !previewOnly {
				site.Set("foot", string(footHtml))
				if err := pb.Save(site); err != nil {
					return nil, err
				}
			}
		}
	}

	return &ImportResult{
		Diff:       diff,
		CreatedIDs: createdIDs,
		Warnings:   warnings,
	}, nil
}

func validateHeadSvelte(data []byte, sourcePath string) error {
	tokenizer := html.NewTokenizer(bytes.NewReader(data))

	for {
		tokenType := tokenizer.Next()

		switch tokenType {
		case html.ErrorToken:
			if tokenizer.Err() == io.EOF {
				return nil
			}
			return fmt.Errorf("%s has invalid head markup: %w", sourcePath, tokenizer.Err())
		case html.StartTagToken, html.SelfClosingTagToken:
			nameBytes, hasAttr := tokenizer.TagName()
			tagName := strings.ToLower(string(nameBytes))

			for hasAttr {
				_, _, moreAttr := tokenizer.TagAttr()
				hasAttr = moreAttr
			}

			if tagName == "svelte:head" {
				return fmt.Errorf("%s contains <svelte:head>. This file is injected into <svelte:head>; remove the wrapper. Keep only head children such as <title>, <meta>, <link>, <script>, and <style>.", sourcePath)
			}
		}
	}
}

func findDirectories(files map[string][]byte, prefix string) []string {
	dirs := make(map[string]bool)
	for path := range files {
		if strings.HasPrefix(path, prefix) {
			rest := strings.TrimPrefix(path, prefix)
			parts := strings.Split(rest, "/")
			if len(parts) > 0 && parts[0] != "" {
				dirs[parts[0]] = true
			}
		}
	}

	result := make([]string, 0, len(dirs))
	for dir := range dirs {
		result = append(result, dir)
	}
	return result
}

// flattenSubfields converts nested subfields format to flat format with parent keys
func flattenSubfields(fields []map[string]interface{}, parentKey string) []map[string]interface{} {
	var result []map[string]interface{}
	for _, field := range fields {
		// Copy the field without subfields
		flat := make(map[string]interface{})
		for k, v := range field {
			if k != "subfields" {
				flat[k] = v
			}
		}
		// Set parent if we have one
		if parentKey != "" {
			flat["parent"] = parentKey
		}
		result = append(result, flat)

		// Recursively flatten subfields
		if subfields, ok := field["subfields"].([]interface{}); ok {
			fieldKey := getString(field, "name")
			for _, sf := range subfields {
				if sfMap, ok := sf.(map[string]interface{}); ok {
					flattened := flattenSubfields([]map[string]interface{}{sfMap}, fieldKey)
					result = append(result, flattened...)
				}
			}
		}
	}
	return result
}

func importBlock(pb *pocketbase.PocketBase, site *core.Record, folderName, displayName string, componentData []byte, blockFields []interface{}, contentData []byte, contentIsYaml bool, existing *core.Record, pathToPageId map[string]string, siteFieldKeyToId map[string]string, pageTypeNameToId map[string]string, pageTypeFieldKeyToId map[string]map[string]string, warnings *[]ImportWarning, sourceFile string) (string, error) {
	symbolsColl, err := pb.FindCollectionByNameOrId("site_symbols")
	if err != nil {
		return "", err
	}

	var symbol *core.Record
	if existing != nil {
		symbol = existing
	} else {
		symbol = core.NewRecord(symbolsColl)
		symbol.Set("site", site.Id)
		// New symbols have no compiled_js file yet. Leave the field nil so
		// PocketBase's file-field validator doesn't reject a stale string
		// reference (mirrors what clone.go does on fresh inserts).
		symbol.Set("compiled_js", nil)
	}

	symbol.Set("name", displayName)

	if componentData != nil {
		// Parse component.svelte to extract html, css, js for the compile
		// path, but also stash the raw source so export can return exactly
		// what was imported. Without raw_source, export reconstructs the
		// file from the parsed columns with hardcoded whitespace and the
		// next file watcher tick stomps the local edit.
		code := string(componentData)
		html, css, js := parseComponent(code)
		symbol.Set("html", html)
		symbol.Set("css", css)
		symbol.Set("js", js)
		symbol.Set("raw_source", code)
	}

	if err := pb.Save(symbol); err != nil {
		pb.Logger().Debug(
			"importBlock save failed",
			"folder", folderName,
			"display_name", displayName,
			"is_new", existing == nil,
			"compiled_js", symbol.Get("compiled_js"),
			"err", err.Error(),
		)
		return "", err
	}

	// Import fields if provided
	if blockFields != nil {
		// Get existing fields and build composite key map
		existingFields, _ := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})
		existingFieldsById := make(map[string]*core.Record)
		for _, f := range existingFields {
			existingFieldsById[f.Id] = f
		}
		existingFieldsByKey := make(map[string]*core.Record)
		for _, f := range existingFields {
			compositeKey := buildBlockFieldCompositeKey(f, existingFieldsById)
			existingFieldsByKey[compositeKey] = f
		}

		// Track which existing field records this import re-used. Anything
		// not matched by the end is a field the user removed from
		// fields.yaml — delete it so stale rows don't keep showing up in the
		// editor or accept content for fields that no longer exist.
		matchedFieldIds := make(map[string]bool)

		fieldsColl, err := pb.FindCollectionByNameOrId("site_symbol_fields")
		if err != nil {
			return "", err
		}

		// Track field key -> record for parent resolution, and fields with parents
		fieldKeyToRecord := make(map[string]*core.Record)
		fieldsWithParent := make([]struct {
			field     *core.Record
			parentKey string
		}, 0)

		// First pass: Create/update all fields without parent relationships
		for i, fieldEntry := range blockFields {
			fieldData, ok := fieldEntry.(map[string]interface{})
			if !ok {
				continue
			}
			fieldKey := getString(fieldData, "name")
			if fieldKey == "" {
				continue
			}

			var field *core.Record
			if existing, ok := existingFieldsByKey[fieldKey]; ok {
				field = existing
			} else {
				field = core.NewRecord(fieldsColl)
				field.Set("symbol", symbol.Id)
			}

			field.Set("key", fieldKey)
			field.Set("label", getString(fieldData, "label"))
			fieldType := getString(fieldData, "type")
			field.Set("type", fieldType)
			field.Set("index", i)

			// Read config (preferred) or options (backwards compatibility)
			config, hasConfig := fieldData["config"]
			if !hasConfig {
				config, hasConfig = fieldData["options"]
			}
			if hasConfig && config != nil {
				// For site-field type, convert field name to field ID
				if fieldType == "site-field" {
					if configMap, ok := config.(map[string]interface{}); ok {
						if fieldName, ok := configMap["field"].(string); ok && fieldName != "" {
							if fieldId, found := siteFieldKeyToId[fieldName]; found {
								configMap["field"] = fieldId
							}
						}
					}
				}
				// For page-list and page types, convert page_type name to page_type ID
				if fieldType == "page-list" || fieldType == "page" {
					if configMap, ok := config.(map[string]interface{}); ok {
						if ptName, ok := configMap["page_type"].(string); ok && ptName != "" {
							if ptId, found := pageTypeNameToId[ptName]; found {
								configMap["page_type"] = ptId
							}
						}
					}
				}
				// For page-field type, convert compound "<page-type>--<field-key>"
				// to a page_type_fields ID. Bare "<field-key>" is accepted but
				// discouraged because reusable blocks have no implicit page-type
				// scope, so the lookup is ambiguous.
				if fieldType == "page-field" {
					if configMap, ok := config.(map[string]interface{}); ok {
						if ref, ok := configMap["field"].(string); ok && ref != "" {
							resolved, warning := resolvePageFieldRef(ref, pageTypeFieldKeyToId, sourceFile, fmt.Sprintf("%s.config.field", fieldKey), fieldKey, displayName)
							if resolved != "" {
								configMap["field"] = resolved
							}
							if warning != nil && warnings != nil {
								*warnings = append(*warnings, *warning)
							}
						}
					}
				}
				field.Set("config", config)
			}
			if placeholder := getString(fieldData, "placeholder"); placeholder != "" {
				field.Set("placeholder", placeholder)
			}
			if help := getString(fieldData, "help"); help != "" {
				field.Set("help", help)
			}

			if err := pb.Save(field); err != nil {
				return "", err
			}
			matchedFieldIds[field.Id] = true

			fieldKeyToRecord[fieldKey] = field

			// Track fields that have a parent for second pass
			if parentKey := getString(fieldData, "parent"); parentKey != "" {
				fieldsWithParent = append(fieldsWithParent, struct {
					field     *core.Record
					parentKey string
				}{field, parentKey})
			}

			// Recursive helper to process subfields at any nesting depth
			var processNestedFields func(parentField *core.Record, parentKey string, nestedFields []interface{}) error
			processNestedFields = func(parentField *core.Record, parentKey string, nestedFields []interface{}) error {
				for j, nestedFieldData := range nestedFields {
					nestedFieldMap, ok := nestedFieldData.(map[string]interface{})
					if !ok {
						continue
					}
					nestedKey := getString(nestedFieldMap, "name")
					if nestedKey == "" {
						continue
					}

					// Check if this nested field already exists using composite key
					compositeKey := parentKey + "/" + nestedKey
					var nestedField *core.Record
					if existing, ok := existingFieldsByKey[compositeKey]; ok {
						nestedField = existing
					} else {
						nestedField = core.NewRecord(fieldsColl)
						nestedField.Set("symbol", symbol.Id)
					}

					nestedField.Set("key", nestedKey)
					nestedField.Set("label", getString(nestedFieldMap, "label"))
					nestedFieldType := getString(nestedFieldMap, "type")
					nestedField.Set("type", nestedFieldType)
					nestedField.Set("parent", parentField.Id)
					nestedField.Set("index", j)

					// Read config (preferred) or options (backwards compatibility)
					nestedConfig, hasNestedConfig := nestedFieldMap["config"]
					if !hasNestedConfig {
						nestedConfig, _ = nestedFieldMap["options"]
					}
					if nestedConfig != nil {
						nestedField.Set("config", nestedConfig)
					}

					if err := pb.Save(nestedField); err != nil {
						return err
					}
					matchedFieldIds[nestedField.Id] = true

					fieldKeyToRecord[compositeKey] = nestedField
					fieldKeyToRecord[nestedKey] = nestedField

					// Recursively process subfields if this is a repeater or group
					if nestedFieldType == "repeater" || nestedFieldType == "group" {
						if subfields, ok := nestedFieldMap["subfields"].([]interface{}); ok {
							if err := processNestedFields(nestedField, compositeKey, subfields); err != nil {
								return err
							}
						}
					}
				}
				return nil
			}

			// Process subfields for repeaters/groups
			if subfields, ok := fieldData["subfields"].([]interface{}); ok {
				if err := processNestedFields(field, fieldKey, subfields); err != nil {
					return "", err
				}
			}
		}

		// Second pass: Set parent relationships
		for _, fp := range fieldsWithParent {
			if parentRecord, ok := fieldKeyToRecord[fp.parentKey]; ok {
				fp.field.Set("parent", parentRecord.Id)
				if err := pb.Save(fp.field); err != nil {
					return "", err
				}
			}
		}

		// Delete fields the user removed from fields.yaml. Cascade rules
		// on site_symbol_fields.parent and *_entries.field handle subfield
		// and content cleanup, so deleting a parent field auto-removes its
		// subfields — swallow not-found errors when we hit a record that
		// was already cascaded away earlier in this loop.
		for _, existing := range existingFields {
			if matchedFieldIds[existing.Id] {
				continue
			}
			if err := pb.Delete(existing); err != nil {
				if _, notFound := pb.FindRecordById("site_symbol_fields", existing.Id); notFound != nil {
					continue
				}
				return "", err
			}
		}
	}

	// Import content entries (default values) if provided
	if contentData != nil {
		var contentMap map[string]interface{}
		var err error
		if contentIsYaml {
			err = yaml.Unmarshal(contentData, &contentMap)
		} else {
			err = json.Unmarshal(contentData, &contentMap)
		}
		if err != nil {
			return "", err
		}

		// Get the fields for this symbol
		fields, _ := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})

		// Build lookup maps
		fieldByKey := make(map[string]*core.Record)
		fieldsByParent := make(map[string][]*core.Record)
		for _, f := range fields {
			fieldByKey[f.GetString("key")] = f
			parentId := f.GetString("parent")
			if parentId != "" {
				fieldsByParent[parentId] = append(fieldsByParent[parentId], f)
			}
		}

		entriesColl, err := pb.FindCollectionByNameOrId("site_symbol_entries")
		if err != nil {
			return "", err
		}

		// Delete ALL existing entries for this symbol's fields (clean slate)
		for _, f := range fields {
			existingEntries, _ := pb.FindRecordsByFilter("site_symbol_entries", "field = {:field}", "", 0, 0, dbx.Params{"field": f.Id})
			for _, entry := range existingEntries {
				pb.Delete(entry)
			}
		}

		// Process top-level content (fields without parent in this symbol)
		for fieldKey, value := range contentMap {
			field, ok := fieldByKey[fieldKey]
			if !ok {
				continue
			}
			// Only process top-level fields here (those without parent or with parent outside this symbol)
			parentId := field.GetString("parent")
			if parentId != "" {
				if _, hasParent := fieldByKey[getFieldKeyById(fields, parentId)]; hasParent {
					continue // This field's parent is in this symbol, will be processed recursively
				}
			}
			if err := importSymbolContentField(pb, entriesColl, field, value, "", 0, fieldsByParent, fieldByKey, pathToPageId); err != nil {
				return "", err
			}
		}
	}

	return symbol.Id, nil
}

// getFieldKeyById finds a field's key by its ID in a list of fields
func getFieldKeyById(fields []*core.Record, id string) string {
	for _, f := range fields {
		if f.Id == id {
			return f.GetString("key")
		}
	}
	return ""
}

// importSymbolContentField recursively imports a symbol field's value, handling repeaters and groups
func importSymbolContentField(pb *pocketbase.PocketBase, entriesColl *core.Collection, field *core.Record, value interface{}, parentEntryId string, index int, fieldsByParent map[string][]*core.Record, fieldByKey map[string]*core.Record, pathToPageId map[string]string) error {
	fieldType := field.GetString("type")
	fieldId := field.Id

	switch fieldType {
	case "repeater":
		// For repeaters, value should be an array
		items, ok := value.([]interface{})
		if !ok {
			return nil
		}

		// Get child fields for this repeater
		childFields := fieldsByParent[fieldId]

		for i, item := range items {
			// Create an entry for this repeater item
			itemEntry := core.NewRecord(entriesColl)
			itemEntry.Set("field", fieldId)
			itemEntry.Set("locale", "en")
			itemEntry.Set("index", i)
			if parentEntryId != "" {
				itemEntry.Set("parent", parentEntryId)
			}
			if err := pb.Save(itemEntry); err != nil {
				return err
			}

			// Process child fields for this item
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := itemMap[childKey] // May be nil if not in YAML, that's ok
				if err := importSymbolContentField(pb, entriesColl, childField, childValue, itemEntry.Id, 0, fieldsByParent, fieldByKey, pathToPageId); err != nil {
					return err
				}
			}
		}

	case "group":
		// For groups, create an entry and process children
		groupEntry := core.NewRecord(entriesColl)
		groupEntry.Set("field", fieldId)
		groupEntry.Set("locale", "en")
		groupEntry.Set("index", index)
		if parentEntryId != "" {
			groupEntry.Set("parent", parentEntryId)
		}
		// Store the whole group value
		groupEntry.Set("value", convertUrlsToPageRefs(value, pathToPageId))
		if err := pb.Save(groupEntry); err != nil {
			return err
		}

		// Process child fields
		childFields := fieldsByParent[fieldId]
		groupMap, ok := value.(map[string]interface{})
		if ok {
			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := groupMap[childKey] // May be nil if not in YAML, that's ok
				if err := importSymbolContentField(pb, entriesColl, childField, childValue, groupEntry.Id, 0, fieldsByParent, fieldByKey, pathToPageId); err != nil {
					return err
				}
			}
		}

	default:
		// Simple field (text, image, link, select, etc.)
		entry := core.NewRecord(entriesColl)
		entry.Set("field", fieldId)
		entry.Set("locale", "en")
		entry.Set("index", index)
		entry.Set("value", convertUrlsToPageRefs(value, pathToPageId))
		if parentEntryId != "" {
			entry.Set("parent", parentEntryId)
		}
		if err := pb.Save(entry); err != nil {
			return err
		}
	}

	return nil
}

// importPageSectionContentField recursively imports a page section field's value, handling repeaters and groups
func importPageSectionContentField(pb *pocketbase.PocketBase, entriesColl *core.Collection, sectionId string, field *core.Record, value interface{}, parentEntryId string, index int, fieldsByParent map[string][]*core.Record, fieldByKey map[string]*core.Record, pathToPageId map[string]string, warnings *[]ImportWarning, sourceFile string, blockName string, pathPrefix string) error {
	fieldType := field.GetString("type")
	fieldId := field.Id

	// Build a set of known child keys for this field, used to detect
	// orphaned (unknown) keys in nested repeater items / group values.
	childFields := fieldsByParent[fieldId]
	knownChildKeys := make(map[string]struct{}, len(childFields))
	for _, cf := range childFields {
		knownChildKeys[cf.GetString("key")] = struct{}{}
	}

	switch fieldType {
	case "repeater":
		// For repeaters, value should be an array
		items, ok := value.([]interface{})
		if !ok {
			return nil
		}

		for i, item := range items {
			// Create an entry for this repeater item
			itemEntry := core.NewRecord(entriesColl)
			itemEntry.Set("section", sectionId)
			itemEntry.Set("field", fieldId)
			itemEntry.Set("locale", "en")
			itemEntry.Set("index", i)
			if parentEntryId != "" {
				itemEntry.Set("parent", parentEntryId)
			}
			if err := pb.Save(itemEntry); err != nil {
				return err
			}

			// Process child fields for this item
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			// Detect orphaned keys in this repeater item before processing
			// declared children, so unexpected content is never silently lost.
			if warnings != nil && len(childFields) == 0 && len(itemMap) > 0 {
				*warnings = append(*warnings, ImportWarning{
					Kind:  "missing_subfields",
					File:  sourceFile,
					Path:  fmt.Sprintf("%s[%d]", pathPrefix, i),
					Field: field.GetString("key"),
					Block: blockName,
					Message: fmt.Sprintf(
						"%s: repeater %q in block %q imported item %d as an empty object because the block had no subfields for that repeater at import time. Re-import this page after fixing blocks/%s/fields.yaml.",
						sourceFile, pathPrefix, blockName, i, sanitizeFilename(blockName),
					),
				})
			} else if warnings != nil && len(knownChildKeys) > 0 {
				for key := range itemMap {
					if _, known := knownChildKeys[key]; !known {
						*warnings = append(*warnings, ImportWarning{
							Kind:  "orphaned_field",
							File:  sourceFile,
							Path:  fmt.Sprintf("%s[%d].%s", pathPrefix, i, key),
							Field: key,
							Block: blockName,
							Message: fmt.Sprintf(
								"%s: repeater item %d under %q has key %q which is not defined as a subfield. Content for this key was not imported.",
								sourceFile, i, pathPrefix, key,
							),
						})
					}
				}
			}

			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := itemMap[childKey] // May be nil if not in YAML, that's ok
				childPath := fmt.Sprintf("%s[%d].%s", pathPrefix, i, childKey)
				if err := importPageSectionContentField(pb, entriesColl, sectionId, childField, childValue, itemEntry.Id, 0, fieldsByParent, fieldByKey, pathToPageId, warnings, sourceFile, blockName, childPath); err != nil {
					return err
				}
			}
		}

	case "group":
		// For groups, create an entry and process children
		groupEntry := core.NewRecord(entriesColl)
		groupEntry.Set("section", sectionId)
		groupEntry.Set("field", fieldId)
		groupEntry.Set("locale", "en")
		groupEntry.Set("index", index)
		if parentEntryId != "" {
			groupEntry.Set("parent", parentEntryId)
		}
		// Store the whole group value
		groupEntry.Set("value", convertUrlsToPageRefs(value, pathToPageId))
		if err := pb.Save(groupEntry); err != nil {
			return err
		}

		// Process child fields
		groupMap, ok := value.(map[string]interface{})
		if ok {
			if warnings != nil && len(childFields) == 0 && len(groupMap) > 0 {
				*warnings = append(*warnings, ImportWarning{
					Kind:  "missing_subfields",
					File:  sourceFile,
					Path:  pathPrefix,
					Field: field.GetString("key"),
					Block: blockName,
					Message: fmt.Sprintf(
						"%s: group %q in block %q imported as an empty object because the block had no subfields for that group at import time. Re-import this page after fixing blocks/%s/fields.yaml.",
						sourceFile, pathPrefix, blockName, sanitizeFilename(blockName),
					),
				})
			} else if warnings != nil && len(knownChildKeys) > 0 {
				for key := range groupMap {
					if _, known := knownChildKeys[key]; !known {
						*warnings = append(*warnings, ImportWarning{
							Kind:  "orphaned_field",
							File:  sourceFile,
							Path:  fmt.Sprintf("%s.%s", pathPrefix, key),
							Field: key,
							Block: blockName,
							Message: fmt.Sprintf(
								"%s: group at %q has key %q which is not defined as a subfield. Content for this key was not imported.",
								sourceFile, pathPrefix, key,
							),
						})
					}
				}
			}

			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := groupMap[childKey] // May be nil if not in YAML, that's ok
				childPath := fmt.Sprintf("%s.%s", pathPrefix, childKey)
				if err := importPageSectionContentField(pb, entriesColl, sectionId, childField, childValue, groupEntry.Id, 0, fieldsByParent, fieldByKey, pathToPageId, warnings, sourceFile, blockName, childPath); err != nil {
					return err
				}
			}
		}

	default:
		// Simple field (text, image, link, select, etc.)
		// A declared subfield can be absent from the YAML (e.g. a repeater item
		// that omits an optional image). Skip it entirely rather than persisting
		// an entry with a NULL value: the read path (useContent / get_empty_value)
		// and the editor field components already treat a missing entry as the
		// field's empty value, so a stored NULL only creates a landmine — e.g.
		// ImageField dereferencing value.width on null. Skipping also keeps the
		// YAML round-trip clean (no empty objects re-emitted on export).
		if value == nil {
			return nil
		}
		entry := core.NewRecord(entriesColl)
		entry.Set("section", sectionId)
		entry.Set("field", fieldId)
		entry.Set("locale", "en")
		entry.Set("index", index)
		entry.Set("value", convertUrlsToPageRefs(value, pathToPageId))
		if parentEntryId != "" {
			entry.Set("parent", parentEntryId)
		}
		if err := pb.Save(entry); err != nil {
			return err
		}
	}

	return nil
}

// pageContentValues resolves page-level field values from a page YAML.
// `fields:` is canonical (the page's own fields). `content:` is a tolerated
// legacy alias from older exports; when both are present, `fields:` wins.
func pageContentValues(pageData ExportedPage) (map[string]interface{}, string) {
	if len(pageData.Fields) == 0 {
		return pageData.Content, "content"
	}
	if len(pageData.Content) == 0 {
		return pageData.Fields, "fields"
	}

	merged := make(map[string]interface{}, len(pageData.Fields)+len(pageData.Content))
	for key, value := range pageData.Content {
		merged[key] = value
	}
	for key, value := range pageData.Fields {
		merged[key] = value
	}
	return merged, "fields"
}

// PocketBase record ids are exactly 15 lowercase-alphanumeric characters. A
// text field with this pattern is validated on Save regardless of how the value
// was set, so we must reject anything that doesn't match before assigning it.
var pbRecordIdPattern = regexp.MustCompile(`^[a-z0-9]{15}$`)

func importPage(pb *pocketbase.PocketBase, site *core.Record, pageData ExportedPage, existing *core.Record, folderToDisplayName map[string]string, parentId string, pagePath string, warnings *[]ImportWarning) (string, []string, error) {
	pagesColl, err := pb.FindCollectionByNameOrId("pages")
	if err != nil {
		return "", nil, err
	}

	var page *core.Record
	if existing != nil {
		page = existing
	} else {
		page = core.NewRecord(pagesColl)
		// Preserve the exported _id as the record id so cross-file page
		// references (site nav links, in-content links) stay valid across a
		// fresh/bootstrap import. Without this the record gets a new random
		// id while files still reference the old one, orphaning every link.
		// Guard on PocketBase's full id format (15 lowercase-alphanumeric
		// chars), not just length — a malformed 15-char value passes the
		// length check but fails pattern validation in pb.Save below. Fall
		// back to an auto-generated id for anything that doesn't match.
		if pbRecordIdPattern.MatchString(pageData.ID) {
			page.Set("id", pageData.ID)
		}
		page.Set("site", site.Id)
	}

	// Derive slug from file path (last segment)
	// e.g., "menu" -> "menu", "about/team" -> "team", "" -> ""
	slug := pagePath
	if lastSlash := strings.LastIndex(pagePath, "/"); lastSlash >= 0 {
		slug = pagePath[lastSlash+1:]
	}

	// Build the source file path for this page for warning messages.
	sourceFile := "pages/index.yaml"
	if pagePath != "" {
		sourceFile = "pages/" + pagePath + ".yaml"
	}

	page.Set("name", pageData.Name)
	page.Set("slug", slug)
	page.Set("parent", parentId)

	// Find page type by name or slug-style name
	if pageData.PageType != "" {
		// Try exact name match first
		pt, err := pb.FindFirstRecordByFilter("page_types", "site = {:site} && name = {:name}", dbx.Params{"site": site.Id, "name": pageData.PageType})
		if err != nil {
			// Try matching by sanitized name (folder name style)
			allPts, _ := pb.FindRecordsByFilter("page_types", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
			for _, candidate := range allPts {
				if sanitizeFilename(candidate.GetString("name")) == pageData.PageType {
					pt = candidate
					break
				}
			}
		}
		if pt != nil {
			page.Set("page_type", pt.Id)
		}
	}

	if err := pb.Save(page); err != nil {
		return "", nil, err
	}

	// Import page-type field values (page_entries)
	pageContent, pageContentPathPrefix := pageContentValues(pageData)
	if len(pageContent) > 0 && page.GetString("page_type") == "" {
		if warnings != nil {
			*warnings = append(*warnings, ImportWarning{
				Kind:  "missing_page_type",
				File:  sourceFile,
				Path:  pageContentPathPrefix,
				Field: pageContentPathPrefix,
				Message: fmt.Sprintf(
					"%s has page content, but page type %q could not be resolved. Page content was not imported. Add or fix the page_type value before saving again.",
					sourceFile, pageData.PageType,
				),
			})
		}
	} else if len(pageContent) > 0 {
		pageTypeId := page.GetString("page_type")

		// Get page type fields - map field key/name -> field id
		ptFields, _ := pb.FindRecordsByFilter("page_type_fields", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pageTypeId})
		fieldByKey := make(map[string]string)
		for _, f := range ptFields {
			key := f.GetString("key")
			if key == "" {
				key = f.GetString("name")
			}
			fieldByKey[key] = f.Id
		}

		// Get existing page entries
		existingEntries, _ := pb.FindRecordsByFilter("page_entries", "page = {:page}", "", 0, 0, dbx.Params{"page": page.Id})
		entryByField := make(map[string]*core.Record)
		for _, e := range existingEntries {
			entryByField[e.GetString("field")] = e
		}

		entriesColl, err := pb.FindCollectionByNameOrId("page_entries")
		if err != nil {
			return "", nil, err
		}

		for fieldKey, value := range pageContent {
			fieldId := fieldByKey[fieldKey]
			if fieldId == "" {
				if warnings != nil {
					pageTypeName := pageData.PageType
					if pageTypeName == "" {
						pageTypeName = pageTypeId
					}
					*warnings = append(*warnings, ImportWarning{
						Kind:  "orphaned_page_field",
						File:  sourceFile,
						Path:  fmt.Sprintf("%s.%s", pageContentPathPrefix, fieldKey),
						Field: fieldKey,
						Message: fmt.Sprintf(
							"%s has page content for field %q, but page type %q has no such field. Content for this field was not imported. Add the field to page-types/%s/fields.yaml or remove it from the page.",
							sourceFile, fieldKey, pageTypeName, sanitizeFilename(pageTypeName),
						),
					})
				}
				continue
			}

			var entry *core.Record
			if existing, ok := entryByField[fieldId]; ok {
				entry = existing
			} else {
				entry = core.NewRecord(entriesColl)
				entry.Set("page", page.Id)
				entry.Set("field", fieldId)
				entry.Set("locale", "en")
			}

			entry.Set("value", normalizeValueForStorage(value))

			if err := pb.Save(entry); err != nil {
				return "", nil, err
			}
		}
	}

	sectionIds := make([]string, len(pageData.Sections))

	// Import sections (blocks on the page)
	if len(pageData.Sections) > 0 {
		// Get existing sections, indexed by record ID for stable matching.
		// Matching by array position would corrupt rows whenever the user
		// reorders or inserts sections — the inserted section would inherit
		// the previously-occupying row's ID, and the displaced section would
		// be created fresh. Use the YAML's _id as the source of truth.
		existingSections, _ := pb.FindRecordsByFilter("page_sections", "page = {:page}", "+index", 0, 0, dbx.Params{"page": page.Id})
		existingById := make(map[string]*core.Record, len(existingSections))
		for _, s := range existingSections {
			existingById[s.Id] = s
		}
		matchedIds := make(map[string]bool, len(existingSections))

		sectionsColl, _ := pb.FindCollectionByNameOrId("page_sections")
		entriesColl, _ := pb.FindCollectionByNameOrId("page_section_entries")

		// Get symbol name -> id mapping (case-insensitive)
		symbols, _ := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
		symbolByName := make(map[string]string)
		for _, s := range symbols {
			name := s.GetString("name")
			symbolByName[name] = s.Id
			symbolByName[strings.ToLower(name)] = s.Id
			symbolByName[sanitizeFilename(name)] = s.Id
		}
		// Also map folder names to symbol IDs (for export compatibility)
		for folderName, displayName := range folderToDisplayName {
			if symbolId := symbolByName[displayName]; symbolId != "" {
				symbolByName[folderName] = symbolId
				symbolByName[strings.ToLower(folderName)] = symbolId
			}
		}

		for i, sectionData := range pageData.Sections {
			blockName := getString(sectionData, "block")
			symbolId := symbolByName[blockName]
			if symbolId == "" {
				// Try lowercase lookup
				symbolId = symbolByName[strings.ToLower(blockName)]
			}
			if symbolId == "" {
				if warnings != nil {
					*warnings = append(*warnings, ImportWarning{
						Kind:    "unknown_block",
						File:    sourceFile,
						Path:    fmt.Sprintf("sections[%d].block", i),
						Block:   blockName,
						Message: fmt.Sprintf("section %d references block %q which does not exist; section skipped", i, blockName),
					})
				}
				continue
			}

			// Match by _id when present, else treat as a new section.
			// The user-authored YAML _id is authoritative; falling back to
			// array index would mean reorders rewrite the wrong rows.
			sectionIdInYaml := getString(sectionData, "_id")

			var section *core.Record
			if sectionIdInYaml != "" {
				if matchedIds[sectionIdInYaml] {
					// Two YAML sections share the same _id — only the first
					// can map to the existing record. Treat the rest as new.
					if warnings != nil {
						*warnings = append(*warnings, ImportWarning{
							Kind:    "duplicate_section_id",
							File:    sourceFile,
							Path:    fmt.Sprintf("sections[%d]._id", i),
							Block:   blockName,
							Message: fmt.Sprintf("section %d has _id %q which is also used by an earlier section; treated as a new section. Remove the duplicate _id to silence this warning.", i, sectionIdInYaml),
						})
					}
				} else if existing, ok := existingById[sectionIdInYaml]; ok {
					section = existing
					matchedIds[sectionIdInYaml] = true
				}
			}
			if section == nil {
				section = core.NewRecord(sectionsColl)
				section.Set("page", page.Id)
			}

			section.Set("symbol", symbolId)
			section.Set("index", i)

			if err := pb.Save(section); err != nil {
				return "", nil, err
			}
			sectionIds[i] = section.Id

			// Import section content
			if content, ok := sectionData["content"].(map[string]interface{}); ok {
				// Get symbol fields
				symbolFields, _ := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "", 0, 0, dbx.Params{"symbol": symbolId})

				// Build lookup maps
				fieldByKey := make(map[string]*core.Record)
				fieldsByParent := make(map[string][]*core.Record)
				for _, f := range symbolFields {
					fieldByKey[f.GetString("key")] = f
					parentId := f.GetString("parent")
					if parentId != "" {
						fieldsByParent[parentId] = append(fieldsByParent[parentId], f)
					}
				}

				// Delete ALL existing entries for this section (clean slate)
				existingEntries, _ := pb.FindRecordsByFilter("page_section_entries", "section = {:section}", "", 0, 0, dbx.Params{"section": section.Id})
				for _, entry := range existingEntries {
					pb.Delete(entry)
				}

				// Process top-level content (fields without parent in this symbol)
				for fieldKey, value := range content {
					field, ok := fieldByKey[fieldKey]
					if !ok {
						// Orphaned field: the page references a field that
						// doesn't exist in the block's current schema. Report
						// it loudly so the user can either add the field to
						// the block or remove it from the page — rather than
						// silently dropping their content.
						if warnings != nil {
							*warnings = append(*warnings, ImportWarning{
								Kind:  "orphaned_field",
								File:  sourceFile,
								Path:  fmt.Sprintf("sections[%d].content.%s", i, fieldKey),
								Field: fieldKey,
								Block: blockName,
								Message: fmt.Sprintf(
									"%s section %d (block %q) has content for field %q, but block %q has no such field. Content for this field was not imported. Add the field to blocks/%s/fields.yaml or remove it from the page.",
									sourceFile, i, blockName, fieldKey, blockName, sanitizeFilename(blockName),
								),
							})
						}
						continue
					}
					// Only process top-level fields here
					parentId := field.GetString("parent")
					if parentId != "" {
						if _, hasParent := fieldByKey[getFieldKeyById(symbolFields, parentId)]; hasParent {
							continue // This field's parent is in this symbol, will be processed recursively
						}
					}
					itemPath := fmt.Sprintf("sections[%d].content.%s", i, fieldKey)
					if err := importPageSectionContentField(pb, entriesColl, section.Id, field, value, "", 0, fieldsByParent, fieldByKey, nil, warnings, sourceFile, blockName, itemPath); err != nil {
						return "", nil, err
					}
				}
			}
		}

		// Delete sections the user removed from YAML. Anything in the DB
		// not matched by an _id in this import is stale.
		for id, existing := range existingById {
			if matchedIds[id] {
				continue
			}
			if err := pb.Delete(existing); err != nil {
				return "", nil, err
			}
		}
	}

	return page.Id, sectionIds, nil
}

func importSiteFields(pb *pocketbase.PocketBase, site *core.Record, data []byte) error {
	fieldEntries, err := parseBareFieldList(data, "site/fields.yaml")
	if err != nil {
		return err
	}
	fields := fieldListToMaps(fieldEntries)

	// Flatten nested subfields to flat format with parent keys
	fields = flattenSubfields(fields, "")

	fieldsColl, err := pb.FindCollectionByNameOrId("site_fields")
	if err != nil {
		return err
	}

	existingFields, _ := pb.FindRecordsByFilter("site_fields", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})

	// Build a map from field ID -> key for resolving parent keys
	existingIdToKey := make(map[string]string)
	for _, f := range existingFields {
		existingIdToKey[f.Id] = f.GetString("key")
	}

	// Build existingByCompositeKey using "parentKey/fieldKey" as the composite key
	// This handles fields with the same name at different nesting levels
	existingByCompositeKey := make(map[string]*core.Record)
	for _, f := range existingFields {
		fieldKey := f.GetString("key")
		parentId := f.GetString("parent")
		parentKey := ""
		if parentId != "" {
			parentKey = existingIdToKey[parentId]
		}
		compositeKey := parentKey + "/" + fieldKey
		existingByCompositeKey[compositeKey] = f
	}

	// Track composite key -> record for parent resolution, and fields with parents
	fieldKeyToRecord := make(map[string]*core.Record)
	fieldsWithParent := make([]struct {
		field        *core.Record
		parentKey    string
		compositeKey string
	}, 0)

	// First pass: Create/update all fields without parent relationships
	for i, fieldData := range fields {
		fieldKey := getString(fieldData, "name") // exported as "name" but stored as "key"
		if fieldKey == "" {
			continue
		}

		parentKey := getString(fieldData, "parent")
		compositeKey := parentKey + "/" + fieldKey

		var field *core.Record
		if existing, ok := existingByCompositeKey[compositeKey]; ok {
			field = existing
		} else {
			field = core.NewRecord(fieldsColl)
			field.Set("site", site.Id)
		}

		field.Set("key", fieldKey)
		field.Set("label", getString(fieldData, "label"))
		field.Set("type", getString(fieldData, "type"))
		field.Set("index", i)

		// Read config (preferred) or options (backwards compatibility)
		config, hasConfig := fieldData["config"]
		if !hasConfig {
			config, hasConfig = fieldData["options"]
		}
		if hasConfig && config != nil {
			field.Set("config", config)
		}

		if err := pb.Save(field); err != nil {
			return err
		}

		// Store by both simple key (for top-level lookups) and composite key (for nested lookups)
		fieldKeyToRecord[fieldKey] = field
		fieldKeyToRecord[compositeKey] = field

		// Track fields that have a parent for second pass
		if parentKey != "" {
			fieldsWithParent = append(fieldsWithParent, struct {
				field        *core.Record
				parentKey    string
				compositeKey string
			}{field, parentKey, compositeKey})
		}
	}

	// Second pass: Set parent relationships
	for _, fp := range fieldsWithParent {
		if parentRecord, ok := fieldKeyToRecord[fp.parentKey]; ok {
			fp.field.Set("parent", parentRecord.Id)
			if err := pb.Save(fp.field); err != nil {
				return err
			}
		}
	}

	return nil
}

// importPageTypeFieldsOnly creates/updates page_type_fields rows for a page
// type ahead of block import, returning a key -> ID map for page-field
// resolution in blocks. The full importPageType still runs in pass 2 and
// re-processes these rows idempotently.
func importPageTypeFieldsOnly(pb *pocketbase.PocketBase, pageType *core.Record, ptFields []interface{}, pageTypeNameToId map[string]string) (map[string]string, error) {
	keyToId := make(map[string]string)

	fieldsColl, err := pb.FindCollectionByNameOrId("page_type_fields")
	if err != nil {
		return keyToId, err
	}

	existingFields, _ := pb.FindRecordsByFilter("page_type_fields", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pageType.Id})
	existingByKey := make(map[string]*core.Record)
	for _, f := range existingFields {
		existingByKey[f.GetString("key")] = f
	}

	for i, fieldEntry := range ptFields {
		fieldData, ok := fieldEntry.(map[string]interface{})
		if !ok {
			continue
		}
		fieldKey := getString(fieldData, "name")
		if fieldKey == "" {
			continue
		}

		var field *core.Record
		if existing, ok := existingByKey[fieldKey]; ok {
			field = existing
		} else {
			field = core.NewRecord(fieldsColl)
			field.Set("page_type", pageType.Id)
		}

		field.Set("key", fieldKey)
		field.Set("label", getString(fieldData, "label"))
		ptFieldType := getString(fieldData, "type")
		field.Set("type", ptFieldType)
		field.Set("index", i)

		ptFieldConfig, hasPtFieldConfig := fieldData["config"]
		if !hasPtFieldConfig {
			ptFieldConfig, hasPtFieldConfig = fieldData["options"]
		}
		if hasPtFieldConfig && ptFieldConfig != nil {
			if ptFieldType == "page-list" || ptFieldType == "page" {
				if configMap, ok := ptFieldConfig.(map[string]interface{}); ok {
					if ptName, ok := configMap["page_type"].(string); ok && ptName != "" {
						if ptId, found := pageTypeNameToId[ptName]; found {
							configMap["page_type"] = ptId
						}
					}
				}
			}
			field.Set("config", ptFieldConfig)
		}

		if err := pb.Save(field); err != nil {
			return keyToId, err
		}
		keyToId[fieldKey] = field.Id
	}

	return keyToId, nil
}

// resolvePageFieldRef parses a page-field config.field value and returns the
// page_type_fields record ID it points to, plus an optional ImportWarning.
//
// Compound form "<page-type>--<field-key>" is the documented shape — folder
// names are stable references per AGENTS.md and a reusable block has no
// implicit page-type scope. A bare "<field-key>" is accepted only when there
// is exactly one matching field across all page types in the import (else the
// reference is ambiguous and we leave the raw value in place so the editor
// surfaces "Unknown field").
func resolvePageFieldRef(ref string, pageTypeFieldKeyToId map[string]map[string]string, sourceFile, path, fieldKey, blockName string) (string, *ImportWarning) {
	if idx := strings.Index(ref, "--"); idx >= 0 {
		ptKey := ref[:idx]
		fk := ref[idx+2:]
		fields, ok := pageTypeFieldKeyToId[ptKey]
		if !ok {
			return "", &ImportWarning{
				Kind:    "orphaned_page_field",
				File:    sourceFile,
				Path:    path,
				Field:   fieldKey,
				Block:   blockName,
				Message: fmt.Sprintf("page-field %q references page type %q which does not exist. Add page-types/%s/ or fix the reference.", ref, ptKey, ptKey),
			}
		}
		fieldId, ok := fields[fk]
		if !ok {
			return "", &ImportWarning{
				Kind:    "orphaned_page_field",
				File:    sourceFile,
				Path:    path,
				Field:   fieldKey,
				Block:   blockName,
				Message: fmt.Sprintf("page-field %q references field %q on page type %q, but no such field exists. Add it to page-types/%s/fields.yaml or fix the reference.", ref, fk, ptKey, ptKey),
			}
		}
		return fieldId, nil
	}

	// Bare key (no compound). Try to find a unique match across all page types.
	var hits []string
	seenIds := make(map[string]bool)
	for _, fields := range pageTypeFieldKeyToId {
		if id, ok := fields[ref]; ok && !seenIds[id] {
			seenIds[id] = true
			hits = append(hits, id)
		}
	}
	if len(hits) == 1 {
		return hits[0], &ImportWarning{
			Kind:    "orphaned_page_field",
			File:    sourceFile,
			Path:    path,
			Field:   fieldKey,
			Block:   blockName,
			Message: fmt.Sprintf("page-field %q uses a bare field key. Prefer compound form \"<page-type>--%s\" so the reference is unambiguous when the block is reused.", ref, ref),
		}
	}
	return "", &ImportWarning{
		Kind:    "orphaned_page_field",
		File:    sourceFile,
		Path:    path,
		Field:   fieldKey,
		Block:   blockName,
		Message: fmt.Sprintf("page-field %q is ambiguous or unresolved (matched %d page types). Use compound form \"<page-type>--<field-key>\".", ref, len(hits)),
	}
}

// importSiteFieldsWithMap imports site fields and returns a map of field key -> field ID
// This is used to resolve site-field references in blocks
func importSiteFieldsWithMap(pb *pocketbase.PocketBase, site *core.Record, data []byte) (map[string]string, error) {
	keyToId := make(map[string]string)

	fieldEntries, err := parseBareFieldList(data, "site/fields.yaml")
	if err != nil {
		return keyToId, err
	}
	fields := fieldListToMaps(fieldEntries)

	// Flatten nested subfields to flat format with parent keys
	fields = flattenSubfields(fields, "")

	fieldsColl, err := pb.FindCollectionByNameOrId("site_fields")
	if err != nil {
		return keyToId, err
	}

	existingFields, _ := pb.FindRecordsByFilter("site_fields", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})

	// Build a map from field ID -> key for resolving parent keys
	existingIdToKey := make(map[string]string)
	for _, f := range existingFields {
		existingIdToKey[f.Id] = f.GetString("key")
	}

	// Build existingByCompositeKey using "parentKey/fieldKey" as the composite key
	existingByCompositeKey := make(map[string]*core.Record)
	for _, f := range existingFields {
		fieldKey := f.GetString("key")
		parentId := f.GetString("parent")
		parentKey := ""
		if parentId != "" {
			parentKey = existingIdToKey[parentId]
		}
		compositeKey := parentKey + "/" + fieldKey
		existingByCompositeKey[compositeKey] = f
	}

	// Track composite key -> record for parent resolution, and fields with parents
	fieldKeyToRecord := make(map[string]*core.Record)
	fieldsWithParent := make([]struct {
		field        *core.Record
		parentKey    string
		compositeKey string
	}, 0)

	// First pass: Create/update all fields without parent relationships
	for i, fieldData := range fields {
		fieldKey := getString(fieldData, "name")
		if fieldKey == "" {
			continue
		}

		parentKey := getString(fieldData, "parent")
		compositeKey := parentKey + "/" + fieldKey

		var field *core.Record
		if existing, ok := existingByCompositeKey[compositeKey]; ok {
			field = existing
		} else {
			field = core.NewRecord(fieldsColl)
			field.Set("site", site.Id)
		}

		field.Set("key", fieldKey)
		field.Set("label", getString(fieldData, "label"))
		field.Set("type", getString(fieldData, "type"))
		field.Set("index", i)

		// Read config (preferred) or options (backwards compatibility)
		fieldConfig, hasFieldConfig := fieldData["config"]
		if !hasFieldConfig {
			fieldConfig, hasFieldConfig = fieldData["options"]
		}
		if hasFieldConfig && fieldConfig != nil {
			field.Set("config", fieldConfig)
		}

		if err := pb.Save(field); err != nil {
			return keyToId, err
		}

		// Build the key -> ID map (use simple key for top-level lookups)
		keyToId[fieldKey] = field.Id

		// Store by both simple key and composite key
		fieldKeyToRecord[fieldKey] = field
		fieldKeyToRecord[compositeKey] = field

		// Track fields that have a parent for second pass
		if parentKey != "" {
			fieldsWithParent = append(fieldsWithParent, struct {
				field        *core.Record
				parentKey    string
				compositeKey string
			}{field, parentKey, compositeKey})
		}
	}

	// Second pass: Set parent relationships
	for _, fp := range fieldsWithParent {
		if parentRecord, ok := fieldKeyToRecord[fp.parentKey]; ok {
			fp.field.Set("parent", parentRecord.Id)
			if err := pb.Save(fp.field); err != nil {
				return keyToId, err
			}
		}
	}

	return keyToId, nil
}

func importSiteContent(pb *pocketbase.PocketBase, site *core.Record, data []byte, isYaml bool, pathToPageId map[string]string) error {
	var content map[string]interface{}
	var err error
	if isYaml {
		err = yaml.Unmarshal(data, &content)
	} else {
		err = json.Unmarshal(data, &content)
	}
	if err != nil {
		return err
	}

	// Convert URL-based links to page references
	content = convertUrlsToPageRefs(content, pathToPageId).(map[string]interface{})

	// Get all fields for this site
	fields, _ := pb.FindRecordsByFilter("site_fields", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})

	// Build field maps
	fieldByKey := make(map[string]*core.Record)
	fieldsByParent := make(map[string][]*core.Record) // parent field ID -> child fields
	for _, f := range fields {
		fieldByKey[f.GetString("key")] = f
		parentId := f.GetString("parent")
		if parentId != "" {
			fieldsByParent[parentId] = append(fieldsByParent[parentId], f)
		}
	}

	entriesColl, err := pb.FindCollectionByNameOrId("site_entries")
	if err != nil {
		return err
	}

	// Delete all existing entries for this site (clean slate for repeaters)
	existingEntries, _ := pb.FindRecordsByFilter("site_entries", "field.site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
	for _, e := range existingEntries {
		pb.Delete(e)
	}

	// Process top-level content (fields without parent)
	for fieldKey, value := range content {
		field := fieldByKey[fieldKey]
		if field == nil {
			continue
		}
		// Only process top-level fields (no parent)
		if field.GetString("parent") != "" {
			continue
		}

		if err := importSiteContentField(pb, entriesColl, field, value, "", 0, fieldsByParent, fieldByKey); err != nil {
			return err
		}
	}

	return nil
}

// importSiteContentField recursively imports a field's value, handling repeaters and groups
func importSiteContentField(pb *pocketbase.PocketBase, entriesColl *core.Collection, field *core.Record, value interface{}, parentEntryId string, index int, fieldsByParent map[string][]*core.Record, fieldByKey map[string]*core.Record) error {
	fieldType := field.GetString("type")
	fieldId := field.Id

	switch fieldType {
	case "repeater":
		// For repeaters, value should be an array
		items, ok := value.([]interface{})
		if !ok {
			return nil
		}

		// Get child fields for this repeater
		childFields := fieldsByParent[fieldId]

		for i, item := range items {
			// Create an entry for this repeater item
			itemEntry := core.NewRecord(entriesColl)
			itemEntry.Set("field", fieldId)
			itemEntry.Set("locale", "en")
			itemEntry.Set("index", i)
			if parentEntryId != "" {
				itemEntry.Set("parent", parentEntryId)
			}
			if err := pb.Save(itemEntry); err != nil {
				return err
			}

			// Process child fields for this item
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := itemMap[childKey] // May be nil if not in YAML, that's ok
				if err := importSiteContentField(pb, entriesColl, childField, childValue, itemEntry.Id, 0, fieldsByParent, fieldByKey); err != nil {
					return err
				}
			}
		}

	case "group":
		// For groups, create an entry and process children
		groupEntry := core.NewRecord(entriesColl)
		groupEntry.Set("field", fieldId)
		groupEntry.Set("locale", "en")
		groupEntry.Set("index", index)
		if parentEntryId != "" {
			groupEntry.Set("parent", parentEntryId)
		}
		// Store the whole group value (normalized to prevent byte array issues)
		groupEntry.Set("value", normalizeValueForStorage(value))
		if err := pb.Save(groupEntry); err != nil {
			return err
		}

		// Process child fields
		childFields := fieldsByParent[fieldId]
		groupMap, ok := value.(map[string]interface{})
		if ok {
			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := groupMap[childKey] // May be nil if not in YAML, that's ok
				if err := importSiteContentField(pb, entriesColl, childField, childValue, groupEntry.Id, 0, fieldsByParent, fieldByKey); err != nil {
					return err
				}
			}
		}

	default:
		// Simple field (text, image, link, select, etc.)
		entry := core.NewRecord(entriesColl)
		entry.Set("field", fieldId)
		entry.Set("locale", "en")
		entry.Set("index", index)
		entry.Set("value", normalizeValueForStorage(value))
		if parentEntryId != "" {
			entry.Set("parent", parentEntryId)
		}
		if err := pb.Save(entry); err != nil {
			return err
		}
	}

	return nil
}

// parseComponent extracts html, css, and js from a Svelte component file
func parseComponent(code string) (html, css, js string) {
	// Extract <style> content
	styleRe := regexp.MustCompile(`(?s)<style[^>]*>(.*?)</style>`)
	if match := styleRe.FindStringSubmatch(code); len(match) > 1 {
		css = strings.TrimSpace(match[1])
	}

	// Extract <script> content
	scriptRe := regexp.MustCompile(`(?s)<script[^>]*>(.*?)</script>`)
	if match := scriptRe.FindStringSubmatch(code); len(match) > 1 {
		js = strings.TrimSpace(match[1])
	}

	// HTML is everything else
	html = code
	html = styleRe.ReplaceAllString(html, "")
	html = scriptRe.ReplaceAllString(html, "")
	html = strings.TrimSpace(html)

	return html, css, js
}

func importPageType(pb *pocketbase.PocketBase, site *core.Record, ptFolder string, ptData ExportedPageType, ptFields []interface{}, existing *core.Record, folderToDisplayName map[string]string, layoutData *ExportedLayout, ptHead *string, ptFoot *string, pageTypeNameToId map[string]string, blockDefaultContent map[string]map[string]interface{}, warnings *[]ImportWarning) error {
	configPath := fmt.Sprintf("page-types/%s/config.yaml", ptFolder)
	layoutPath := fmt.Sprintf("page-types/%s/layout.yaml", ptFolder)
	ptColl, err := pb.FindCollectionByNameOrId("page_types")
	if err != nil {
		return err
	}

	var pageType *core.Record
	if existing != nil {
		pageType = existing
	} else {
		pageType = core.NewRecord(ptColl)
		pageType.Set("site", site.Id)
	}

	pageType.Set("name", ptData.Name)
	if ptData.Icon != "" {
		pageType.Set("icon", ptData.Icon)
	}
	if ptData.Color != "" {
		pageType.Set("color", ptData.Color)
	}
	// head/foot are nil when the corresponding file is absent (preserve existing
	// DB value); when present we write the file's contents verbatim, including
	// empty string, so deleting the contents on disk clears the column.
	if ptHead != nil {
		pageType.Set("head", *ptHead)
	}
	if ptFoot != nil {
		pageType.Set("foot", *ptFoot)
	}

	if err := pb.Save(pageType); err != nil {
		return err
	}

	// Import page type fields. Always run, even when ptFields is empty,
	// so removing all fields from the YAML actually clears the DB.
	{
		fieldsColl, err := pb.FindCollectionByNameOrId("page_type_fields")
		if err != nil {
			return err
		}

		existingFields, _ := pb.FindRecordsByFilter("page_type_fields", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pageType.Id})
		existingByKey := make(map[string]*core.Record)
		for _, f := range existingFields {
			existingByKey[f.GetString("key")] = f
		}

		// Track which existing field records this import re-used. Anything
		// not matched by the end is a field the user removed from the YAML.
		matchedFieldIds := make(map[string]bool)

		// Track field key -> record for parent resolution, and fields with parents
		fieldKeyToRecord := make(map[string]*core.Record)
		fieldsWithParent := make([]struct {
			field     *core.Record
			parentKey string
		}, 0)

		// First pass: Create/update all fields without parent relationships
		for i, fieldEntry := range ptFields {
			fieldData, ok := fieldEntry.(map[string]interface{})
			if !ok {
				continue
			}
			fieldKey := getString(fieldData, "name")
			if fieldKey == "" {
				continue
			}

			var field *core.Record
			if existing, ok := existingByKey[fieldKey]; ok {
				field = existing
			} else {
				field = core.NewRecord(fieldsColl)
				field.Set("page_type", pageType.Id)
			}

			field.Set("key", fieldKey)
			field.Set("label", getString(fieldData, "label"))
			ptFieldType := getString(fieldData, "type")
			field.Set("type", ptFieldType)
			field.Set("index", i)

			// Read config (preferred) or options (backwards compatibility)
			ptFieldConfig, hasPtFieldConfig := fieldData["config"]
			if !hasPtFieldConfig {
				ptFieldConfig, hasPtFieldConfig = fieldData["options"]
			}
			if hasPtFieldConfig && ptFieldConfig != nil {
				// For page-list and page types, convert page_type name to page_type ID
				if ptFieldType == "page-list" || ptFieldType == "page" {
					if configMap, ok := ptFieldConfig.(map[string]interface{}); ok {
						if ptName, ok := configMap["page_type"].(string); ok && ptName != "" {
							if ptId, found := pageTypeNameToId[ptName]; found {
								configMap["page_type"] = ptId
							}
						}
					}
				}
				field.Set("config", ptFieldConfig)
			}

			if err := pb.Save(field); err != nil {
				return err
			}
			matchedFieldIds[field.Id] = true

			fieldKeyToRecord[fieldKey] = field

			// Track fields that have a parent for second pass
			if parentKey := getString(fieldData, "parent"); parentKey != "" {
				fieldsWithParent = append(fieldsWithParent, struct {
					field     *core.Record
					parentKey string
				}{field, parentKey})
			}
		}

		// Second pass: Set parent relationships
		for _, fp := range fieldsWithParent {
			if parentRecord, ok := fieldKeyToRecord[fp.parentKey]; ok {
				fp.field.Set("parent", parentRecord.Id)
				if err := pb.Save(fp.field); err != nil {
					return err
				}
			}
		}

		// Delete fields the user removed from page-type config.yaml.
		// Cascade rules on page_type_fields.parent and the entry tables
		// handle subfield + content cleanup; tolerate already-cascaded
		// records.
		for _, existing := range existingFields {
			if matchedFieldIds[existing.Id] {
				continue
			}
			if err := pb.Delete(existing); err != nil {
				if _, notFound := pb.FindRecordById("page_type_fields", existing.Id); notFound != nil {
					continue
				}
				return err
			}
		}
	}

	// Import page_type_symbols (allowed blocks on this page type).
	//
	// allowed_blocks is the source of truth — the YAML's list determines
	// which page_type_symbols rows should exist. Rows for blocks not in
	// the list are deleted, so:
	//   - shrinking the list actually removes blocks from the page type
	//   - removing the key entirely makes the page type "static" in the
	//     editor (UI gates add/remove on row count)
	// Previously, only inserts ran, so stale rows lingered.
	ptSymbolsColl, err := pb.FindCollectionByNameOrId("page_type_symbols")
	if err != nil {
		return err
	}

	// Get all symbols for this site
	symbols, _ := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
	symbolByName := make(map[string]string)
	for _, s := range symbols {
		name := s.GetString("name")
		symbolByName[name] = s.Id
		symbolByName[strings.ToLower(name)] = s.Id
		symbolByName[sanitizeFilename(name)] = s.Id
	}
	// Also map folder names to symbol IDs
	for folderName, displayName := range folderToDisplayName {
		if symbolId := symbolByName[displayName]; symbolId != "" {
			symbolByName[folderName] = symbolId
			symbolByName[strings.ToLower(folderName)] = symbolId
		}
	}

	// Get existing page_type_symbols
	existingPtSymbols, _ := pb.FindRecordsByFilter("page_type_symbols", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pageType.Id})
	existingBySymbol := make(map[string]*core.Record)
	for _, pts := range existingPtSymbols {
		existingBySymbol[pts.GetString("symbol")] = pts
	}

	// Resolve YAML names to symbol IDs and remember which rows we kept,
	// so we can delete the rest at the end.
	wantedSymbolIds := make(map[string]bool)
	for i, blockName := range ptData.AllowedBlocks {
		symbolId := symbolByName[blockName]
		if symbolId == "" {
			symbolId = symbolByName[strings.ToLower(blockName)]
		}
		if symbolId == "" {
			*warnings = append(*warnings, ImportWarning{
				Kind:    "missing_symbol",
				File:    configPath,
				Path:    fmt.Sprintf("allowed_blocks[%d]", i),
				Block:   blockName,
				Message: fmt.Sprintf("allowed_blocks[%d] references block %q, which is not a registered symbol on this site. Add blocks/%s/ or fix the reference; otherwise this block will not appear in the page type.", i, blockName, blockName),
			})
			continue
		}
		wantedSymbolIds[symbolId] = true

		var ptSymbol *core.Record
		if existing, ok := existingBySymbol[symbolId]; ok {
			ptSymbol = existing
		} else {
			ptSymbol = core.NewRecord(ptSymbolsColl)
			ptSymbol.Set("page_type", pageType.Id)
			ptSymbol.Set("symbol", symbolId)
		}

		ptSymbol.Set("index", i)

		if err := pb.Save(ptSymbol); err != nil {
			return err
		}
	}

	// Delete rows that are no longer wanted (stale entries from a previous
	// import where allowed_blocks was longer or referenced different blocks).
	for symbolId, pts := range existingBySymbol {
		if wantedSymbolIds[symbolId] {
			continue
		}
		if err := pb.Delete(pts); err != nil {
			return err
		}
	}

	// Import header/footer sections from layout.yaml.
	//
	// When layoutData is non-nil (layout.yaml was present in the import), the
	// file is authoritative: we wipe existing page_type_sections and rewrite
	// them. This must run even when both lists are empty, otherwise removing
	// all entries from layout.yaml would leave stale sections in the DB.
	//
	// When layoutData is nil (no layout.yaml in the import at all), leave
	// existing sections alone — the user simply didn't touch the layout.
	if layoutData != nil {
		ptSectionsColl, err := pb.FindCollectionByNameOrId("page_type_sections")
		if err != nil {
			return err
		}

		// Get all symbols for this site
		symbols, _ := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
		symbolByName := make(map[string]string)
		symbolFields := make(map[string][]*core.Record) // symbolId -> fields
		for _, s := range symbols {
			name := s.GetString("name")
			symbolByName[name] = s.Id
			symbolByName[strings.ToLower(name)] = s.Id
			symbolByName[sanitizeFilename(name)] = s.Id
			// Fetch fields for this symbol
			fields, _ := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": s.Id})
			symbolFields[s.Id] = fields
		}
		// Also map folder names to symbol IDs
		for folderName, displayName := range folderToDisplayName {
			if symbolId := symbolByName[displayName]; symbolId != "" {
				symbolByName[folderName] = symbolId
				symbolByName[strings.ToLower(folderName)] = symbolId
			}
		}

		resolveLayoutContent := func(sectionData ExportedLayoutSection) map[string]interface{} {
			if len(sectionData.Content) > 0 {
				return sectionData.Content
			}
			if blockDefaultContent == nil {
				return nil
			}
			if content := blockDefaultContent[sectionData.Block]; content != nil {
				return content
			}
			return blockDefaultContent[strings.ToLower(sectionData.Block)]
		}

		// Delete all existing sections for this page type first (clean slate)
		existingSections, _ := pb.FindRecordsByFilter("page_type_sections", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pageType.Id})
		for _, s := range existingSections {
			pb.Delete(s)
		}

		// Import header sections
		for i, sectionData := range layoutData.Header {
			symbolId := symbolByName[sectionData.Block]
			if symbolId == "" {
				symbolId = symbolByName[strings.ToLower(sectionData.Block)]
			}
			if symbolId == "" {
				*warnings = append(*warnings, ImportWarning{
					Kind:    "missing_symbol",
					File:    layoutPath,
					Path:    fmt.Sprintf("header[%d].block", i),
					Block:   sectionData.Block,
					Message: fmt.Sprintf("header[%d] references block %q, which is not a registered symbol on this site. Pages of this type will render with no header for this slot. Add blocks/%s/ or fix the reference.", i, sectionData.Block, sectionData.Block),
				})
				continue
			}

			section := core.NewRecord(ptSectionsColl)
			section.Set("page_type", pageType.Id)
			section.Set("zone", "header")
			section.Set("index", i)
			section.Set("symbol", symbolId)

			if err := pb.Save(section); err != nil {
				return err
			}

			// Import content entries for this section. If layout.yaml omits
			// content, seed it from the block's content.yaml defaults so
			// layout-mounted blocks behave like newly-added page sections.
			if content := resolveLayoutContent(sectionData); content != nil {
				if err := importPageTypeSectionContent(pb, section, symbolFields[symbolId], content); err != nil {
					return err
				}
			}
		}

		// Import body sections into the page type layout (zone "body"). These are
		// seed defaults only: the editor copies them onto a page's own sections
		// when a new page of this type is created. Import writes the page-type
		// layout exclusively — it never creates or mutates pages, and the renderer
		// sources page body from each page's own sections, not from here. A body
		// block may reference a block outside allowed_blocks — that is allowed by
		// design (e.g. a one-off hero), so we only warn when the block is not a
		// registered symbol at all.
		for i, sectionData := range layoutData.Body {
			symbolId := symbolByName[sectionData.Block]
			if symbolId == "" {
				symbolId = symbolByName[strings.ToLower(sectionData.Block)]
			}
			if symbolId == "" {
				*warnings = append(*warnings, ImportWarning{
					Kind:    "missing_symbol",
					File:    layoutPath,
					Path:    fmt.Sprintf("body[%d].block", i),
					Block:   sectionData.Block,
					Message: fmt.Sprintf("body[%d] references block %q, which is not a registered symbol on this site. New pages of this type will seed with no block for this section. Add blocks/%s/ or fix the reference.", i, sectionData.Block, sectionData.Block),
				})
				continue
			}

			section := core.NewRecord(ptSectionsColl)
			section.Set("page_type", pageType.Id)
			section.Set("zone", "body")
			section.Set("index", i)
			section.Set("symbol", symbolId)

			if err := pb.Save(section); err != nil {
				return err
			}

			// Import content entries for this section. If layout.yaml omits
			// content, seed it from the block's content.yaml defaults so
			// layout-mounted blocks behave like newly-added page sections.
			if content := resolveLayoutContent(sectionData); content != nil {
				if err := importPageTypeSectionContent(pb, section, symbolFields[symbolId], content); err != nil {
					return err
				}
			}
		}

		// Import footer sections
		for i, sectionData := range layoutData.Footer {
			symbolId := symbolByName[sectionData.Block]
			if symbolId == "" {
				symbolId = symbolByName[strings.ToLower(sectionData.Block)]
			}
			if symbolId == "" {
				*warnings = append(*warnings, ImportWarning{
					Kind:    "missing_symbol",
					File:    layoutPath,
					Path:    fmt.Sprintf("footer[%d].block", i),
					Block:   sectionData.Block,
					Message: fmt.Sprintf("footer[%d] references block %q, which is not a registered symbol on this site. Pages of this type will render with no footer for this slot. Add blocks/%s/ or fix the reference.", i, sectionData.Block, sectionData.Block),
				})
				continue
			}

			section := core.NewRecord(ptSectionsColl)
			section.Set("page_type", pageType.Id)
			section.Set("zone", "footer")
			section.Set("index", i)
			section.Set("symbol", symbolId)

			if err := pb.Save(section); err != nil {
				return err
			}

			// Import content entries for this section. If layout.yaml omits
			// content, seed it from the block's content.yaml defaults so
			// layout-mounted blocks behave like newly-added page sections.
			if content := resolveLayoutContent(sectionData); content != nil {
				if err := importPageTypeSectionContent(pb, section, symbolFields[symbolId], content); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// importPageTypeSectionContent imports content entries for a page type section from layout.yaml
func importPageTypeSectionContent(pb *pocketbase.PocketBase, section *core.Record, fields []*core.Record, content map[string]interface{}) error {
	entriesColl, err := pb.FindCollectionByNameOrId("page_type_section_entries")
	if err != nil {
		return err
	}

	// Delete existing entries for this section
	existingEntries, _ := pb.FindRecordsByFilter("page_type_section_entries", "section = {:section}", "", 0, 0, dbx.Params{"section": section.Id})
	for _, e := range existingEntries {
		pb.Delete(e)
	}

	// Build field lookup maps
	fieldByKey := make(map[string]*core.Record)
	fieldsByParent := make(map[string][]*core.Record)
	for _, f := range fields {
		fieldByKey[f.GetString("key")] = f
		parentId := f.GetString("parent")
		fieldsByParent[parentId] = append(fieldsByParent[parentId], f)
	}

	// Import each content field
	for key, value := range content {
		field, ok := fieldByKey[key]
		if !ok {
			continue
		}
		if err := importPageTypeSectionContentField(pb, entriesColl, section.Id, field, value, "", 0, fieldsByParent, fieldByKey); err != nil {
			return err
		}
	}

	return nil
}

// importPageTypeSectionContentField recursively imports a page type section field's value
func importPageTypeSectionContentField(pb *pocketbase.PocketBase, entriesColl *core.Collection, sectionId string, field *core.Record, value interface{}, parentEntryId string, index int, fieldsByParent map[string][]*core.Record, fieldByKey map[string]*core.Record) error {
	fieldType := field.GetString("type")
	fieldId := field.Id

	switch fieldType {
	case "repeater":
		items, ok := value.([]interface{})
		if !ok {
			return nil
		}

		childFields := fieldsByParent[fieldId]

		for i, item := range items {
			itemEntry := core.NewRecord(entriesColl)
			itemEntry.Set("section", sectionId)
			itemEntry.Set("field", fieldId)
			itemEntry.Set("locale", "en")
			itemEntry.Set("index", i)
			if parentEntryId != "" {
				itemEntry.Set("parent", parentEntryId)
			}
			if err := pb.Save(itemEntry); err != nil {
				return err
			}

			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := itemMap[childKey] // May be nil if not in YAML, that's ok
				if err := importPageTypeSectionContentField(pb, entriesColl, sectionId, childField, childValue, itemEntry.Id, 0, fieldsByParent, fieldByKey); err != nil {
					return err
				}
			}
		}

	case "group":
		groupEntry := core.NewRecord(entriesColl)
		groupEntry.Set("section", sectionId)
		groupEntry.Set("field", fieldId)
		groupEntry.Set("locale", "en")
		groupEntry.Set("index", index)
		if parentEntryId != "" {
			groupEntry.Set("parent", parentEntryId)
		}
		groupEntry.Set("value", value)
		if err := pb.Save(groupEntry); err != nil {
			return err
		}

		childFields := fieldsByParent[fieldId]
		groupMap, ok := value.(map[string]interface{})
		if ok {
			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := groupMap[childKey] // May be nil if not in YAML, that's ok
				if err := importPageTypeSectionContentField(pb, entriesColl, sectionId, childField, childValue, groupEntry.Id, 0, fieldsByParent, fieldByKey); err != nil {
					return err
				}
			}
		}

	default:
		entry := core.NewRecord(entriesColl)
		entry.Set("section", sectionId)
		entry.Set("field", fieldId)
		entry.Set("locale", "en")
		entry.Set("index", index)
		entry.Set("value", value)
		if parentEntryId != "" {
			entry.Set("parent", parentEntryId)
		}
		if err := pb.Save(entry); err != nil {
			return err
		}
	}

	return nil
}

// Note: getString is defined in clone.go

// normalizeValueForStorage ensures values are properly typed before storing in PocketBase.
// This prevents []byte values from being stored as arrays of numbers in JSON fields.
func normalizeValueForStorage(v interface{}) interface{} {
	switch val := v.(type) {
	case []byte:
		// Try to unmarshal as JSON first
		var result interface{}
		if err := json.Unmarshal(val, &result); err == nil {
			return normalizeValueForStorage(result) // Recursively normalize
		}
		// If not valid JSON, return as string
		return string(val)
	case map[string]interface{}:
		normalized := make(map[string]interface{})
		for k, v := range val {
			normalized[k] = normalizeValueForStorage(v)
		}
		return normalized
	case []interface{}:
		normalized := make([]interface{}, len(val))
		for i, v := range val {
			normalized[i] = normalizeValueForStorage(v)
		}
		return normalized
	default:
		return v
	}
}

// convertUrlsToPageRefs recursively processes content values and converts internal URL links to page references.
// For link fields with a URL starting with "/", it attempts to find the page by path and converts to page reference format.
// It also normalizes values to ensure proper storage (e.g., converting []byte to string).
func convertUrlsToPageRefs(value interface{}, pathToPageId map[string]string) interface{} {
	// First normalize the value to handle any []byte types
	value = normalizeValueForStorage(value)

	switch v := value.(type) {
	case map[string]interface{}:
		// Check if this looks like a link field with url but no page
		if urlVal, hasUrl := v["url"]; hasUrl {
			if _, hasPage := v["page"]; !hasPage {
				// Only convert if url is a string starting with /
				if urlStr, ok := urlVal.(string); ok && strings.HasPrefix(urlStr, "/") {
					// Extract path from URL (e.g., "/company/about" -> "company/about", "/" -> "")
					path := strings.TrimPrefix(urlStr, "/")
					path = strings.TrimSuffix(path, "/")

					// Look up page by full path
					if pageId, found := pathToPageId[path]; found {
						// Convert to page reference format
						result := make(map[string]interface{})
						for k, val := range v {
							if k != "url" {
								result[k] = val
							}
						}
						result["page"] = pageId
						return result
					}
				}
			}
		}

		// Recursively process all values in the map
		result := make(map[string]interface{})
		for k, val := range v {
			result[k] = convertUrlsToPageRefs(val, pathToPageId)
		}
		return result

	case []interface{}:
		// Recursively process array items
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = convertUrlsToPageRefs(item, pathToPageId)
		}
		return result

	default:
		return value
	}
}

// buildPagePathMap creates a map of full page paths to page IDs for a site.
// Paths are built by walking the parent hierarchy (e.g., "company/about" for a nested page).
func buildPagePathMap(pb *pocketbase.PocketBase, siteId string) (map[string]string, error) {
	pages, err := pb.FindRecordsByFilter("pages", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}

	// Build lookup maps for parent and slug
	parentMap := make(map[string]string)
	slugMap := make(map[string]string)
	for _, page := range pages {
		parentMap[page.Id] = page.GetString("parent")
		slugMap[page.Id] = page.GetString("slug")
	}

	// Build full path for each page
	pathToId := make(map[string]string)
	for _, page := range pages {
		path := buildFullPagePath(page.Id, parentMap, slugMap)
		pathToId[path] = page.Id
	}

	return pathToId, nil
}

// buildFullPagePath constructs the full URL path for a page by walking its parent hierarchy.
// Returns path without leading/trailing slashes (e.g., "company/about", "" for homepage).
func buildFullPagePath(pageId string, parentMap, slugMap map[string]string) string {
	var parts []string
	current := pageId

	for current != "" {
		slug := slugMap[current]
		// Skip empty slugs and "index" (homepage marker)
		if slug != "" && slug != "index" {
			parts = append([]string{slug}, parts...)
		}
		current = parentMap[current]
	}

	return strings.Join(parts, "/")
}

// uploadReconcileEntry captures everything the CLI needs to write back after
// a successful reconcile of one uploads/ file: the record id (so symbolic
// yaml refs can be rewritten to that id locally), the canonical filename
// PocketBase assigned (so the local file can be renamed to match server state),
// and the content hash (so the CLI can skip re-uploading unchanged bytes on a
// later push without touching the server).
// Canonical may equal Symbolic when the file already existed with no suffix.
type uploadReconcileEntry struct {
	ID        string
	Canonical string
	Hash      string // hex-encoded sha256 of the stored bytes, empty if unknown
}

// upsertSiteUpload creates or updates a single site_uploads record from raw
// bytes, keyed by filename. It is the shared core used by both the zip import
// path (reconcileSiteUploads) and the incremental upload endpoint
// (/api/primo/uploads/{siteId}/put), so the two paths can never drift in how
// they hash, dedup, or suffix filenames.
//
// existingByFilename lets callers that already fetched the site's uploads pass
// the record in so we don't re-query per file; pass nil to have the record
// resolved on demand. uploadsColl and fsys are likewise passed in by the batch
// caller and resolved lazily otherwise.
//
// Returns the reconcile entry (id, canonical name, content hash) plus whether
// bytes actually changed on the server (false for a no-op that matched the
// stored hash), so callers can report accurate diffs.
func upsertSiteUpload(
	pb *pocketbase.PocketBase,
	site *core.Record,
	filename string,
	data []byte,
	existing *core.Record,
	uploadsColl *core.Collection,
	fsys *filesystem.System,
) (entry uploadReconcileEntry, changed bool, err error) {
	incomingHash := sha256.Sum256(data)
	incomingHex := hex.EncodeToString(incomingHash[:])

	if uploadsColl == nil {
		uploadsColl, err = pb.FindCollectionByNameOrId("site_uploads")
		if err != nil {
			return entry, false, fmt.Errorf("failed to find site_uploads collection: %w", err)
		}
	}

	if existing != nil {
		// Compare with the stored bytes so that a true no-op push doesn't
		// rewrite the file (and bump updated timestamps, invalidate CDN
		// caches, etc.). On read failure we conservatively skip the reupload —
		// the record still resolves correctly downstream. Storage is keyed by
		// collection id, not name.
		if fsys == nil {
			fsys, err = pb.NewFilesystem()
			if err != nil {
				return entry, false, fmt.Errorf("failed to open filesystem for upload upsert: %w", err)
			}
			defer fsys.Close()
		}
		sourceKey := uploadsColl.Id + "/" + existing.Id + "/" + filename
		reader, readErr := fsys.GetFile(sourceKey)
		if readErr == nil {
			existingBytes, _ := io.ReadAll(reader)
			reader.Close()
			existingHash := sha256.Sum256(existingBytes)
			if hex.EncodeToString(existingHash[:]) == incomingHex {
				return uploadReconcileEntry{ID: existing.Id, Canonical: filename, Hash: incomingHex}, false, nil
			}
		}

		// Bytes diverged — replace the file in-place so the record id stays
		// stable and any yaml already referencing it keeps working. The
		// on-disk name picks up a fresh PocketBase suffix, so re-read the
		// record after Save to capture the canonical filename for writeback.
		file, ferr := filesystem.NewFileFromBytes(data, filename)
		if ferr != nil {
			return entry, false, fmt.Errorf("failed to wrap upload %s: %w", filename, ferr)
		}
		existing.Set("file", file)
		if serr := pb.Save(existing); serr != nil {
			return entry, false, fmt.Errorf("failed to update upload %s: %w", filename, serr)
		}
		return uploadReconcileEntry{ID: existing.Id, Canonical: existing.GetString("file"), Hash: incomingHex}, true, nil
	}

	// New file → create a record. PocketBase appends a random suffix to the
	// stored filename (e.g. hero.png → hero_a8x.png) to guarantee uniqueness
	// inside the record's storage dir. We accept that — the caller's original
	// filename is the symbolic key (what yaml references), and the canonical
	// filename we read off the record after Save is what the CLI renames the
	// local file to.
	rec := core.NewRecord(uploadsColl)
	rec.Set("site", site.Id)
	file, ferr := filesystem.NewFileFromBytes(data, filename)
	if ferr != nil {
		return entry, false, fmt.Errorf("failed to wrap upload %s: %w", filename, ferr)
	}
	rec.Set("file", file)
	if serr := pb.Save(rec); serr != nil {
		return entry, false, fmt.Errorf("failed to create upload %s: %w", filename, serr)
	}
	return uploadReconcileEntry{ID: rec.Id, Canonical: rec.GetString("file"), Hash: incomingHex}, true, nil
}

// reconcileSiteUploads brings server-side site_uploads records in sync with
// the uploads/ folder in an import zip. For every file under uploads/ (other
// than the manifest), it either reuses an existing record by filename or
// creates a new one. Returns a filename -> {id, canonical} map that
// downstream content rewriting uses to resolve symbolic
// `upload: "uploads/foo.jpg"` references to real PocketBase IDs and that the
// CLI uses to rename local files to their canonical (PocketBase-suffixed)
// names.
//
// Existing records whose filenames don't appear on disk are NOT deleted —
// removing an image is a destructive operation that should be gated behind
// an explicit flag (e.g. `primo push --prune-uploads`). Each orphan emits
// an ImportWarning so the user can see what's happening.
//
// Hash comparison short-circuits re-upload of unchanged binaries, which keeps
// the round-trip case (pull → push with no changes) a true no-op.
func reconcileSiteUploads(pb *pocketbase.PocketBase, site *core.Record, files map[string][]byte, warnings *[]ImportWarning) (map[string]uploadReconcileEntry, error) {
	siteId := site.Id
	filenameToEntry := make(map[string]uploadReconcileEntry)

	// Discover upload binaries shipped in the zip. The manifest itself is
	// metadata, not an upload, and dotfiles are ignored to leave room for
	// future control files alongside .manifest.json.
	type zipUpload struct {
		filename string
		data     []byte
	}
	var zipUploads []zipUpload
	for path, data := range files {
		if !strings.HasPrefix(path, "uploads/") {
			continue
		}
		name := strings.TrimPrefix(path, "uploads/")
		if name == "" || strings.HasPrefix(name, ".") || strings.Contains(name, "/") {
			continue
		}
		zipUploads = append(zipUploads, zipUpload{filename: name, data: data})
	}

	// Index existing records by filename. Filename is the stable key the
	// dashboard already uses for display; PocketBase auto-suffixes on
	// collision, which the file storage layer handles transparently.
	existing, err := pb.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch existing site_uploads: %w", err)
	}
	existingByFilename := make(map[string]*core.Record, len(existing))
	for _, rec := range existing {
		if fn := rec.GetString("file"); fn != "" {
			existingByFilename[fn] = rec
		}
	}

	uploadsColl, err := pb.FindCollectionByNameOrId("site_uploads")
	if err != nil {
		return nil, fmt.Errorf("failed to find site_uploads collection: %w", err)
	}

	fsys, err := pb.NewFilesystem()
	if err != nil {
		return nil, fmt.Errorf("failed to open filesystem for upload reconcile: %w", err)
	}
	defer fsys.Close()

	for _, up := range zipUploads {
		entry, _, err := upsertSiteUpload(pb, site, up.filename, up.data, existingByFilename[up.filename], uploadsColl, fsys)
		if err != nil {
			return nil, err
		}
		filenameToEntry[up.filename] = entry
	}

	// Surface manifest entries that no longer have a file on disk. Auto-
	// deletion is intentionally avoided — see function-level comment.
	if manifestBytes, ok := files["uploads/.manifest.json"]; ok && warnings != nil {
		var manifest map[string]struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(manifestBytes, &manifest) == nil {
			for filename := range manifest {
				if _, present := filenameToEntry[filename]; present {
					continue
				}
				// Only warn for files that still exist server-side. A manifest
				// entry with no matching record on the server is just stale
				// pull metadata and not actionable here.
				if _, hasRecord := existingByFilename[filename]; !hasRecord {
					continue
				}
				*warnings = append(*warnings, ImportWarning{
					Kind:    "orphan_upload",
					File:    "uploads/.manifest.json",
					Path:    filename,
					Message: fmt.Sprintf("uploads/%s exists on the server but no file with that name is in the push. Re-add the file or run `primo push --prune-uploads` to delete the server-side copy.", filename),
				})
			}
		}
	}

	// Existing records whose filenames weren't in the manifest either — for
	// example, dashboard uploads since the last pull — should also stay
	// available to symbolic references, so callers can author against them
	// without re-pulling first. Canonical == the existing filename since
	// the file isn't being re-uploaded.
	for filename, rec := range existingByFilename {
		if _, ok := filenameToEntry[filename]; !ok {
			filenameToEntry[filename] = uploadReconcileEntry{ID: rec.Id, Canonical: filename}
		}
	}

	return filenameToEntry, nil
}

// rewriteUploadRefs walks an arbitrary yaml-decoded value and rewrites every
// `upload: "uploads/<filename>"` string into the corresponding PocketBase
// record ID, in place. Strings that don't start with `uploads/` are left
// untouched, so raw IDs already present in the file (from a prior pull) and
// empty values continue to round-trip cleanly.
//
// This runs once over the parsed file contents up front, so the rest of the
// import pipeline can keep treating image values as opaque maps without
// any awareness of the symbolic-path convention.
func rewriteUploadRefs(value interface{}, uploadMap map[string]uploadReconcileEntry) interface{} {
	switch v := value.(type) {
	case map[string]interface{}:
		for k, val := range v {
			if k == "upload" {
				if s, ok := val.(string); ok && strings.HasPrefix(s, "uploads/") {
					filename := strings.TrimPrefix(s, "uploads/")
					if entry, found := uploadMap[filename]; found {
						v[k] = entry.ID
						continue
					}
				}
			}
			v[k] = rewriteUploadRefs(val, uploadMap)
		}
		return v
	case []interface{}:
		for i, item := range v {
			v[i] = rewriteUploadRefs(item, uploadMap)
		}
		return v
	default:
		return value
	}
}
