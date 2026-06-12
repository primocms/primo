package internal

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"
)

var cloneDebugEnabled = os.Getenv("PRIMOCMS_DEBUG_CLONE") != ""

func cloneLog(format string, args ...any) {
	if !cloneDebugEnabled {
		return
	}
	fmt.Fprintf(os.Stderr, "[clone] "+format+"\n", args...)
}

// Snapshot file signature: legacy "PALACMS:3.0" magic bytes. This is an
// opaque on-disk identifier, not a user-visible brand string, and it must
// match the signature the TS Snapshot codec writes (src/lib/common/models/
// Snapshot.ts) so browser-created .pala/.primo snapshots still import. Kept as
// the legacy bytes across the rebrand; only change it in lockstep with the TS side.
var snapshotSignature = []byte("PALACMS:3.0")

type SnapshotMetadata struct {
	CreatedAt             string `json:"created_at"`
	SourceInstanceId      string `json:"source_instance_id"`
	SourceInstanceVersion string `json:"source_instance_version"`
}

type SnapshotRecords struct {
	Sites                  []map[string]any `json:"sites"`
	SiteUploads            []map[string]any `json:"site_uploads"`
	SiteFields             []map[string]any `json:"site_fields"`
	SiteEntries            []map[string]any `json:"site_entries"`
	SiteSymbols            []map[string]any `json:"site_symbols"`
	SiteSymbolFields       []map[string]any `json:"site_symbol_fields"`
	SiteSymbolEntries      []map[string]any `json:"site_symbol_entries"`
	PageTypes              []map[string]any `json:"page_types"`
	PageTypeFields         []map[string]any `json:"page_type_fields"`
	PageTypeEntries        []map[string]any `json:"page_type_entries"`
	PageTypeSymbols        []map[string]any `json:"page_type_symbols"`
	PageTypeSections       []map[string]any `json:"page_type_sections"`
	PageTypeSectionEntries []map[string]any `json:"page_type_section_entries"`
	Pages                  []map[string]any `json:"pages"`
	PageEntries            []map[string]any `json:"page_entries"`
	PageSections           []map[string]any `json:"page_sections"`
	PageSectionEntries     []map[string]any `json:"page_section_entries"`
}

type FileEntry struct {
	Name string `json:"name"`
	Size int    `json:"size"`
}

type Snapshot struct {
	Metadata SnapshotMetadata
	Records  SnapshotRecords
	Files    [][]byte
	FileMeta []FileEntry
}

type IDMap map[string]string

func RegisterCloneSiteEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/primo/clone-site", func(e *core.RequestEvent) error {
			// Check for multipart form (file upload). HasPrefix on the
			// lowercased value handles "Multipart/Form-Data" casing and the
			// "; boundary=..." parameter suffix in one check.
			contentType := strings.ToLower(e.Request.Header.Get("Content-Type"))
			isMultipart := strings.HasPrefix(contentType, "multipart/form-data")

			var name, host, groupId, sourceSiteId, snapshotURL string
			var snapshotFile []byte

			if isMultipart {
				// Parse multipart form
				if err := e.Request.ParseMultipartForm(maxSnapshotSize); err != nil {
					return e.BadRequestError("Failed to parse form", err)
				}

				name = e.Request.FormValue("name")
				host = e.Request.FormValue("host")
				groupId = e.Request.FormValue("group_id")
				sourceSiteId = e.Request.FormValue("source_site_id")
				snapshotURL = e.Request.FormValue("snapshot_url")

				// Check for snapshot file
				file, _, err := e.Request.FormFile("snapshot_file")
				if err == nil {
					defer file.Close()
					snapshotFile, err = io.ReadAll(io.LimitReader(file, maxSnapshotSize+1))
					if err != nil {
						return e.BadRequestError("Failed to read snapshot file", err)
					}
					if len(snapshotFile) > maxSnapshotSize {
						return e.BadRequestError("Snapshot file exceeds maximum allowed size", nil)
					}
				}
			} else {
				// Parse JSON body
				body := struct {
					SourceSiteId string `json:"source_site_id"`
					SnapshotURL  string `json:"snapshot_url"`
					Name         string `json:"name"`
					Host         string `json:"host"`
					GroupId      string `json:"group_id"`
				}{}

				if err := e.BindBody(&body); err != nil {
					return e.BadRequestError("Invalid request body", err)
				}

				name = body.Name
				host = body.Host
				groupId = body.GroupId
				sourceSiteId = body.SourceSiteId
				snapshotURL = body.SnapshotURL
			}

			if name == "" || host == "" || groupId == "" {
				return e.BadRequestError("Missing required fields: name, host, group_id", nil)
			}

			if e.Auth == nil {
				return e.UnauthorizedError("Authentication required", nil)
			}

			var newSite *core.Record
			var err error

			if len(snapshotFile) > 0 {
				newSite, err = cloneFromSnapshotData(pb, snapshotFile, name, host, groupId)
			} else if snapshotURL != "" {
				newSite, err = cloneFromSnapshot(pb, snapshotURL, name, host, groupId)
			} else if sourceSiteId != "" {
				newSite, err = cloneFromLocalSite(pb, e, sourceSiteId, name, host, groupId)
			} else {
				return e.BadRequestError("Either source_site_id, snapshot_url, or snapshot_file is required", nil)
			}

			if err != nil {
				return e.BadRequestError("Clone failed: "+err.Error(), err)
			}

			return e.JSON(200, map[string]any{
				"id":   newSite.Id,
				"name": newSite.GetString("name"),
				"host": newSite.GetString("host"),
			})
		})
		return serveEvent.Next()
	})
	return nil
}

const maxSnapshotSize = 10 * 1024 * 1024 // 10MB

func cloneFromSnapshotData(pb *pocketbase.PocketBase, data []byte, name, host, groupId string) (*core.Record, error) {
	snapshot, err := parseSnapshot(data)
	if err != nil {
		return nil, err
	}

	var newSite *core.Record
	err = pb.RunInTransaction(func(txApp core.App) error {
		var txErr error
		newSite, txErr = importSnapshotRecords(txApp, snapshot, name, host, groupId)
		return txErr
	})

	return newSite, err
}

func cloneFromSnapshot(pb *pocketbase.PocketBase, snapshotURL, name, host, groupId string) (*core.Record, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(snapshotURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, errors.New("failed to fetch snapshot: " + resp.Status)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxSnapshotSize+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxSnapshotSize {
		return nil, errors.New("snapshot exceeds maximum allowed size")
	}

	snapshot, err := parseSnapshot(data)
	if err != nil {
		return nil, err
	}

	var newSite *core.Record
	err = pb.RunInTransaction(func(txApp core.App) error {
		var txErr error
		newSite, txErr = importSnapshotRecords(txApp, snapshot, name, host, groupId)
		return txErr
	})

	return newSite, err
}

func cloneFromLocalSite(pb *pocketbase.PocketBase, e *core.RequestEvent, sourceSiteId, name, host, groupId string) (*core.Record, error) {
	sourceSite, err := pb.FindRecordById("sites", sourceSiteId)
	if err != nil {
		return nil, errors.New("source site not found")
	}

	info, err := e.RequestInfo()
	if err != nil {
		return nil, err
	}
	canAccess, _ := e.App.CanAccessRecord(sourceSite, info, sourceSite.Collection().ViewRule)
	if !canAccess {
		return nil, errors.New("access denied to source site")
	}

	var newSite *core.Record
	err = pb.RunInTransaction(func(txApp core.App) error {
		var txErr error
		newSite, txErr = cloneSiteRecords(txApp, pb, sourceSite, name, host, groupId)
		return txErr
	})

	return newSite, err
}

func parseSnapshot(data []byte) (*Snapshot, error) {
	reader := bytes.NewReader(data)

	sig := make([]byte, len(snapshotSignature))
	if _, err := reader.Read(sig); err != nil {
		return nil, err
	}
	if !bytes.Equal(sig, snapshotSignature) {
		return nil, errors.New("invalid snapshot signature")
	}

	var sizes [4]uint32
	if err := binary.Read(reader, binary.LittleEndian, &sizes); err != nil {
		return nil, err
	}

	metadataBytes := make([]byte, sizes[0])
	if _, err := reader.Read(metadataBytes); err != nil {
		return nil, err
	}
	var metadata SnapshotMetadata
	if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
		return nil, err
	}

	recordsBytes := make([]byte, sizes[1])
	if _, err := reader.Read(recordsBytes); err != nil {
		return nil, err
	}
	var records SnapshotRecords
	if err := json.Unmarshal(recordsBytes, &records); err != nil {
		return nil, err
	}

	filemetaBytes := make([]byte, sizes[2])
	if _, err := reader.Read(filemetaBytes); err != nil {
		return nil, err
	}
	var fileMeta []FileEntry
	if err := json.Unmarshal(filemetaBytes, &fileMeta); err != nil {
		return nil, err
	}

	files := make([][]byte, len(fileMeta))
	for i, entry := range fileMeta {
		fileData := make([]byte, entry.Size)
		if _, err := reader.Read(fileData); err != nil {
			return nil, err
		}
		files[i] = fileData
	}

	return &Snapshot{
		Metadata: metadata,
		Records:  records,
		Files:    files,
		FileMeta: fileMeta,
	}, nil
}

func importSnapshotRecords(app core.App, snapshot *Snapshot, name, host, groupId string) (*core.Record, error) {
	// ID maps for remapping foreign keys
	siteMap := make(IDMap)
	uploadMap := make(IDMap)
	siteFieldMap := make(IDMap)
	siteSymbolMap := make(IDMap)
	siteSymbolFieldMap := make(IDMap)
	pageTypeMap := make(IDMap)
	pageTypeFieldMap := make(IDMap)
	pageTypeSectionMap := make(IDMap)
	pageMap := make(IDMap)
	pageSectionMap := make(IDMap)

	// 1. Create site
	sitesColl, err := app.FindCollectionByNameOrId("sites")
	if err != nil {
		return nil, err
	}
	var newSite *core.Record

	for _, siteData := range snapshot.Records.Sites {
		newSite = core.NewRecord(sitesColl)
		copyRecordFields(newSite, siteData, sitesColl)
		newSite.Set("name", name)
		newSite.Set("host", host)
		newSite.Set("group", groupId)
		newSite.Set("preview", nil)
		if err := app.Save(newSite); err != nil {
			return nil, err
		}
		siteMap[getString(siteData, "id")] = newSite.Id
	}

	if newSite == nil {
		return nil, errors.New("no site in snapshot")
	}

	// 2. Create site_uploads with files
	uploadsColl, err := app.FindCollectionByNameOrId("site_uploads")
	if err != nil {
		return nil, err
	}
	for _, uploadData := range snapshot.Records.SiteUploads {
		rec := core.NewRecord(uploadsColl)
		copyRecordFields(rec, uploadData, uploadsColl)
		rec.Set("site", newSite.Id)

		// Handle file - in snapshot the "file" field contains the index into the files array
		if fileIdx, ok := uploadData["file"].(float64); ok {
			idx := int(fileIdx)
			if idx >= 0 && idx < len(snapshot.Files) {
				file, err := filesystem.NewFileFromBytes(snapshot.Files[idx], snapshot.FileMeta[idx].Name)
				if err != nil {
					return nil, err
				}
				rec.Set("file", file)
			}
		}

		if err := app.Save(rec); err != nil {
			return nil, err
		}
		uploadMap[getString(uploadData, "id")] = rec.Id
	}

	// 3. Create site_fields (hierarchical - handle parent references)
	siteFieldsColl, err := app.FindCollectionByNameOrId("site_fields")
	if err != nil {
		return nil, err
	}
	if err := importHierarchicalRecords(app, siteFieldsColl, snapshot.Records.SiteFields, "site", newSite.Id, "parent", siteFieldMap); err != nil {
		return nil, err
	}
	cloneLog("[importSnapshotRecords] siteFieldMap has %d entries:", len(siteFieldMap))
	for oldId, newId := range siteFieldMap {
		cloneLog("[importSnapshotRecords]   %s -> %s", oldId, newId)
	}

	// 4. Create site_entries (hierarchical)
	siteEntriesColl, err := app.FindCollectionByNameOrId("site_entries")
	if err != nil {
		return nil, err
	}
	siteEntryMap := make(IDMap)
	if err := importHierarchicalRecordsWithFK(app, siteEntriesColl, snapshot.Records.SiteEntries, "field", siteFieldMap, "parent", siteEntryMap); err != nil {
		return nil, err
	}

	// 5. Create site_symbols
	symbolsColl, err := app.FindCollectionByNameOrId("site_symbols")
	if err != nil {
		return nil, err
	}
	for _, symbolData := range snapshot.Records.SiteSymbols {
		rec := core.NewRecord(symbolsColl)
		copyRecordFields(rec, symbolData, symbolsColl)
		rec.Set("site", newSite.Id)
		rec.Set("compiled_js", nil)
		if err := app.Save(rec); err != nil {
			return nil, err
		}
		siteSymbolMap[getString(symbolData, "id")] = rec.Id
	}

	// 6. Create site_symbol_fields (hierarchical)
	symbolFieldsColl, err := app.FindCollectionByNameOrId("site_symbol_fields")
	if err != nil {
		return nil, err
	}
	if err := importHierarchicalRecordsWithFK(app, symbolFieldsColl, snapshot.Records.SiteSymbolFields, "symbol", siteSymbolMap, "parent", siteSymbolFieldMap); err != nil {
		return nil, err
	}
	cloneLog("[importSnapshotRecords] siteSymbolFieldMap has %d entries", len(siteSymbolFieldMap))
	for oldId, newId := range siteSymbolFieldMap {
		rec, _ := app.FindRecordById("site_symbol_fields", newId)
		if rec != nil && rec.GetString("type") == "site-field" {
			config := rec.Get("config")
			cloneLog("[importSnapshotRecords]   site-field %s -> %s, config: %+v", oldId, newId, config)
		}
	}

	// 7. Create site_symbol_entries (hierarchical)
	symbolEntriesColl, err := app.FindCollectionByNameOrId("site_symbol_entries")
	if err != nil {
		return nil, err
	}
	symbolEntryMap := make(IDMap)
	if err := importHierarchicalRecordsWithFK(app, symbolEntriesColl, snapshot.Records.SiteSymbolEntries, "field", siteSymbolFieldMap, "parent", symbolEntryMap); err != nil {
		return nil, err
	}

	// 8. Create page_types
	pageTypesColl, err := app.FindCollectionByNameOrId("page_types")
	if err != nil {
		return nil, err
	}
	for _, ptData := range snapshot.Records.PageTypes {
		rec := core.NewRecord(pageTypesColl)
		copyRecordFields(rec, ptData, pageTypesColl)
		rec.Set("site", newSite.Id)
		if err := app.Save(rec); err != nil {
			return nil, err
		}
		pageTypeMap[getString(ptData, "id")] = rec.Id
		cloneLog("[importSnapshotRecords] Created page_type: %s -> %s (name: %s, site: %s)", getString(ptData, "id"), rec.Id, rec.GetString("name"), rec.GetString("site"))
	}
	cloneLog("[importSnapshotRecords] pageTypeMap has %d entries", len(pageTypeMap))

	// 9. Create page_type_fields (hierarchical)
	pageTypeFieldsColl, err := app.FindCollectionByNameOrId("page_type_fields")
	if err != nil {
		return nil, err
	}
	if err := importHierarchicalRecordsWithFK(app, pageTypeFieldsColl, snapshot.Records.PageTypeFields, "page_type", pageTypeMap, "parent", pageTypeFieldMap); err != nil {
		return nil, err
	}

	// 10. Create page_type_entries (hierarchical)
	pageTypeEntriesColl, err := app.FindCollectionByNameOrId("page_type_entries")
	if err != nil {
		return nil, err
	}
	pageTypeEntryMap := make(IDMap)
	if err := importHierarchicalRecordsWithFK(app, pageTypeEntriesColl, snapshot.Records.PageTypeEntries, "field", pageTypeFieldMap, "parent", pageTypeEntryMap); err != nil {
		return nil, err
	}

	// 11. Create page_type_symbols
	pageTypeSymbolsColl, err := app.FindCollectionByNameOrId("page_type_symbols")
	if err != nil {
		return nil, err
	}
	for _, ptsData := range snapshot.Records.PageTypeSymbols {
		oldPageType := getString(ptsData, "page_type")
		oldSymbol := getString(ptsData, "symbol")
		newPageType := pageTypeMap[oldPageType]
		newSymbol := siteSymbolMap[oldSymbol]
		if newPageType == "" || newSymbol == "" {
			continue // Skip orphaned references
		}
		rec := core.NewRecord(pageTypeSymbolsColl)
		copyRecordFields(rec, ptsData, pageTypeSymbolsColl)
		rec.Set("page_type", newPageType)
		rec.Set("symbol", newSymbol)
		if err := app.Save(rec); err != nil {
			return nil, err
		}
	}

	// 12. Create page_type_sections
	pageTypeSectionsColl, err := app.FindCollectionByNameOrId("page_type_sections")
	if err != nil {
		return nil, err
	}
	for _, ptsData := range snapshot.Records.PageTypeSections {
		oldPageType := getString(ptsData, "page_type")
		oldSymbol := getString(ptsData, "symbol")
		newPageType := pageTypeMap[oldPageType]
		newSymbol := siteSymbolMap[oldSymbol]
		if newPageType == "" || newSymbol == "" {
			return nil, errors.New("missing page_type or symbol for page_type_section")
		}
		rec := core.NewRecord(pageTypeSectionsColl)
		copyRecordFields(rec, ptsData, pageTypeSectionsColl)
		rec.Set("page_type", newPageType)
		rec.Set("symbol", newSymbol)
		if err := app.Save(rec); err != nil {
			return nil, err
		}
		pageTypeSectionMap[getString(ptsData, "id")] = rec.Id
	}

	// 13. Create page_type_section_entries (hierarchical - arbitrary depth)
	pageTypeSectionEntriesColl, err := app.FindCollectionByNameOrId("page_type_section_entries")
	if err != nil {
		return nil, err
	}
	pageTypeSectionEntryMap := make(IDMap)
	createdPTSE := make(map[string]bool)
	for len(createdPTSE) < len(snapshot.Records.PageTypeSectionEntries) {
		madeProgress := false
		for _, data := range snapshot.Records.PageTypeSectionEntries {
			oldId := getString(data, "id")
			if createdPTSE[oldId] {
				continue
			}
			oldParent := getString(data, "parent")
			if oldParent != "" && pageTypeSectionEntryMap[oldParent] == "" {
				continue // Parent not yet created
			}
			rec := core.NewRecord(pageTypeSectionEntriesColl)
			copyRecordFields(rec, data, pageTypeSectionEntriesColl)
			rec.Set("section", pageTypeSectionMap[getString(data, "section")])
			rec.Set("field", siteSymbolFieldMap[getString(data, "field")])
			if oldParent == "" {
				rec.Set("parent", "")
			} else {
				rec.Set("parent", pageTypeSectionEntryMap[oldParent])
			}
			if err := app.Save(rec); err != nil {
				return nil, err
			}
			pageTypeSectionEntryMap[oldId] = rec.Id
			createdPTSE[oldId] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPTSE) < len(snapshot.Records.PageTypeSectionEntries) {
			cloneLog("[importSnapshotRecords] WARNING: %d page_type_section_entries could not be created", len(snapshot.Records.PageTypeSectionEntries)-len(createdPTSE))
			break
		}
	}

	// 14. Create pages (hierarchical - arbitrary depth)
	pagesColl, err := app.FindCollectionByNameOrId("pages")
	if err != nil {
		return nil, err
	}
	createdPages := make(map[string]bool)
	for len(createdPages) < len(snapshot.Records.Pages) {
		madeProgress := false
		for _, pageData := range snapshot.Records.Pages {
			oldId := getString(pageData, "id")
			if createdPages[oldId] {
				continue
			}
			oldParent := getString(pageData, "parent")
			if oldParent != "" && pageMap[oldParent] == "" {
				continue // Parent not yet created
			}
			rec := core.NewRecord(pagesColl)
			copyRecordFields(rec, pageData, pagesColl)
			rec.Set("site", newSite.Id)
			rec.Set("page_type", pageTypeMap[getString(pageData, "page_type")])
			if oldParent == "" {
				rec.Set("parent", "")
			} else {
				rec.Set("parent", pageMap[oldParent])
			}
			rec.Set("compiled_html", nil)
			if err := app.Save(rec); err != nil {
				return nil, err
			}
			pageMap[oldId] = rec.Id
			createdPages[oldId] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPages) < len(snapshot.Records.Pages) {
			cloneLog("[importSnapshotRecords] WARNING: %d pages could not be created", len(snapshot.Records.Pages)-len(createdPages))
			break
		}
	}

	// 15. Create page_entries (hierarchical - arbitrary depth)
	pageEntriesColl, err := app.FindCollectionByNameOrId("page_entries")
	if err != nil {
		return nil, err
	}
	pageEntryMap := make(IDMap)
	createdPE := make(map[string]bool)
	for len(createdPE) < len(snapshot.Records.PageEntries) {
		madeProgress := false
		for _, data := range snapshot.Records.PageEntries {
			oldId := getString(data, "id")
			if createdPE[oldId] {
				continue
			}
			oldParent := getString(data, "parent")
			if oldParent != "" && pageEntryMap[oldParent] == "" {
				continue // Parent not yet created
			}
			rec := core.NewRecord(pageEntriesColl)
			copyRecordFields(rec, data, pageEntriesColl)
			rec.Set("page", pageMap[getString(data, "page")])
			rec.Set("field", pageTypeFieldMap[getString(data, "field")])
			if oldParent == "" {
				rec.Set("parent", "")
			} else {
				rec.Set("parent", pageEntryMap[oldParent])
			}
			if err := app.Save(rec); err != nil {
				return nil, err
			}
			pageEntryMap[oldId] = rec.Id
			createdPE[oldId] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPE) < len(snapshot.Records.PageEntries) {
			cloneLog("[importSnapshotRecords] WARNING: %d page_entries could not be created", len(snapshot.Records.PageEntries)-len(createdPE))
			break
		}
	}

	// 16. Create page_sections
	pageSectionsColl, err := app.FindCollectionByNameOrId("page_sections")
	if err != nil {
		return nil, err
	}
	for _, psData := range snapshot.Records.PageSections {
		rec := core.NewRecord(pageSectionsColl)
		copyRecordFields(rec, psData, pageSectionsColl)
		rec.Set("page", pageMap[getString(psData, "page")])
		rec.Set("symbol", siteSymbolMap[getString(psData, "symbol")])
		if err := app.Save(rec); err != nil {
			return nil, err
		}
		pageSectionMap[getString(psData, "id")] = rec.Id
	}

	// 17. Create page_section_entries (hierarchical - arbitrary depth)
	pageSectionEntriesColl, err := app.FindCollectionByNameOrId("page_section_entries")
	if err != nil {
		return nil, err
	}
	pageSectionEntryMap := make(IDMap)
	createdPSE := make(map[string]bool)
	for len(createdPSE) < len(snapshot.Records.PageSectionEntries) {
		madeProgress := false
		for _, data := range snapshot.Records.PageSectionEntries {
			oldId := getString(data, "id")
			if createdPSE[oldId] {
				continue
			}
			oldParent := getString(data, "parent")
			if oldParent != "" && pageSectionEntryMap[oldParent] == "" {
				continue // Parent not yet created
			}
			rec := core.NewRecord(pageSectionEntriesColl)
			copyRecordFields(rec, data, pageSectionEntriesColl)
			rec.Set("section", pageSectionMap[getString(data, "section")])
			rec.Set("field", siteSymbolFieldMap[getString(data, "field")])
			if oldParent == "" {
				rec.Set("parent", "")
			} else {
				rec.Set("parent", pageSectionEntryMap[oldParent])
			}
			if err := app.Save(rec); err != nil {
				return nil, err
			}
			pageSectionEntryMap[oldId] = rec.Id
			createdPSE[oldId] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPSE) < len(snapshot.Records.PageSectionEntries) {
			cloneLog("[importSnapshotRecords] WARNING: %d page_section_entries could not be created", len(snapshot.Records.PageSectionEntries)-len(createdPSE))
			break
		}
	}

	// 18. Update field configs with remapped references
	updateFieldConfigReferences(app, "site_fields", siteFieldMap, pageTypeFieldMap, pageTypeMap, siteFieldMap)
	updateFieldConfigReferences(app, "site_symbol_fields", siteSymbolFieldMap, pageTypeFieldMap, pageTypeMap, siteFieldMap)
	updateFieldConfigReferences(app, "page_type_fields", pageTypeFieldMap, pageTypeFieldMap, pageTypeMap, siteFieldMap)

	// 19. Update entry values with remapped references
	updateEntryValueReferences(app, "site_entries", siteFieldMap, pageMap, uploadMap, siteEntryMap)
	updateEntryValueReferences(app, "site_symbol_entries", siteSymbolFieldMap, pageMap, uploadMap, symbolEntryMap)
	updateEntryValueReferences(app, "page_type_entries", pageTypeFieldMap, pageMap, uploadMap, pageTypeEntryMap)
	updateEntryValueReferences(app, "page_type_section_entries", siteSymbolFieldMap, pageMap, uploadMap, pageTypeSectionEntryMap)
	updateEntryValueReferences(app, "page_entries", pageTypeFieldMap, pageMap, uploadMap, pageEntryMap)
	updateEntryValueReferences(app, "page_section_entries", siteSymbolFieldMap, pageMap, uploadMap, pageSectionEntryMap)

	return newSite, nil
}

// cloneSiteRecords clones a local site
func cloneSiteRecords(txApp core.App, pb *pocketbase.PocketBase, sourceSite *core.Record, name, host, groupId string) (*core.Record, error) {
	siteId := sourceSite.Id

	// ID maps for remapping foreign keys
	uploadMap := make(IDMap)
	siteFieldMap := make(IDMap)
	siteSymbolMap := make(IDMap)
	siteSymbolFieldMap := make(IDMap)
	pageTypeMap := make(IDMap)
	pageTypeFieldMap := make(IDMap)
	pageTypeSectionMap := make(IDMap)
	pageMap := make(IDMap)
	pageSectionMap := make(IDMap)

	// 1. Create site
	sitesColl, err := txApp.FindCollectionByNameOrId("sites")
	if err != nil {
		return nil, err
	}
	newSite := core.NewRecord(sitesColl)
	copyRecordFieldsFromRecord(newSite, sourceSite, sitesColl)
	newSite.Set("name", name)
	newSite.Set("host", host)
	newSite.Set("group", groupId)
	newSite.Set("preview", nil)
	if err := txApp.Save(newSite); err != nil {
		return nil, err
	}

	// 2. Clone site_uploads with files
	uploads, err := pb.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	uploadsColl, _ := txApp.FindCollectionByNameOrId("site_uploads")
	fsys, err := pb.NewFilesystem()
	if err != nil {
		return nil, err
	}
	defer fsys.Close()

	for _, upload := range uploads {
		rec := core.NewRecord(uploadsColl)
		copyRecordFieldsFromRecord(rec, upload, uploadsColl)
		rec.Set("site", newSite.Id)

		// Copy the file
		filename := upload.GetString("file")
		if filename != "" {
			sourceKey := "site_uploads/" + upload.Id + "/" + filename
			fileReader, err := fsys.GetFile(sourceKey)
			if err != nil {
				return nil, err
			}
			fileData, err := io.ReadAll(fileReader)
			fileReader.Close()
			if err != nil {
				return nil, err
			}
			file, err := filesystem.NewFileFromBytes(fileData, filename)
			if err != nil {
				return nil, err
			}
			rec.Set("file", file)
		}

		if err := txApp.Save(rec); err != nil {
			return nil, err
		}
		uploadMap[upload.Id] = rec.Id
	}

	// 3. Clone site_fields (hierarchical)
	siteFields, err := pb.FindRecordsByFilter("site_fields", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	siteFieldsColl, _ := txApp.FindCollectionByNameOrId("site_fields")
	if err := cloneHierarchicalRecords(txApp, siteFieldsColl, siteFields, "site", newSite.Id, "parent", siteFieldMap); err != nil {
		return nil, err
	}
	cloneLog("[cloneSiteRecords] siteFieldMap has %d entries:", len(siteFieldMap))
	for oldId, newId := range siteFieldMap {
		cloneLog("[cloneSiteRecords]   %s -> %s", oldId, newId)
	}

	// 4. Clone site_entries (hierarchical)
	siteEntries, err := pb.FindRecordsByFilter("site_entries", "field.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	siteEntriesColl, _ := txApp.FindCollectionByNameOrId("site_entries")
	siteEntryMap := make(IDMap)
	if err := cloneHierarchicalRecordsWithFK(txApp, siteEntriesColl, siteEntries, "field", siteFieldMap, "parent", siteEntryMap); err != nil {
		return nil, err
	}

	// 5. Clone site_symbols
	symbols, err := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	symbolsColl, _ := txApp.FindCollectionByNameOrId("site_symbols")
	for _, symbol := range symbols {
		rec := core.NewRecord(symbolsColl)
		copyRecordFieldsFromRecord(rec, symbol, symbolsColl)
		rec.Set("site", newSite.Id)
		rec.Set("compiled_js", nil)
		if err := txApp.Save(rec); err != nil {
			return nil, err
		}
		siteSymbolMap[symbol.Id] = rec.Id
	}

	// 6. Clone site_symbol_fields (hierarchical)
	symbolFields, err := pb.FindRecordsByFilter("site_symbol_fields", "symbol.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	// Log source site_symbol_fields with site-field type
	cloneLog("[cloneSiteRecords] Source site_symbol_fields: %d total", len(symbolFields))
	for _, srcField := range symbolFields {
		if srcField.GetString("type") == "site-field" {
			srcConfig := srcField.Get("config")
			cloneLog("[cloneSiteRecords] SOURCE site-field %s (id: %s): config=%+v (type: %T)", srcField.GetString("name"), srcField.Id, srcConfig, srcConfig)
		}
	}

	symbolFieldsColl, _ := txApp.FindCollectionByNameOrId("site_symbol_fields")
	if err := cloneHierarchicalRecordsWithFK(txApp, symbolFieldsColl, symbolFields, "symbol", siteSymbolMap, "parent", siteSymbolFieldMap); err != nil {
		return nil, err
	}
	cloneLog("[cloneSiteRecords] siteSymbolFieldMap has %d entries:", len(siteSymbolFieldMap))
	for oldId, newId := range siteSymbolFieldMap {
		// Get the new record to see its type
		rec, _ := txApp.FindRecordById("site_symbol_fields", newId)
		if rec != nil {
			cloneLog("[cloneSiteRecords]   %s -> %s (type: %s, name: %s)", oldId, newId, rec.GetString("type"), rec.GetString("name"))
			if rec.GetString("type") == "site-field" {
				config := rec.Get("config")
				cloneLog("[cloneSiteRecords]     CLONED config: %+v (type: %T)", config, config)
			}
		}
	}

	// 7. Clone site_symbol_entries (hierarchical)
	symbolEntries, err := pb.FindRecordsByFilter("site_symbol_entries", "field.symbol.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	symbolEntriesColl, _ := txApp.FindCollectionByNameOrId("site_symbol_entries")
	symbolEntryMap := make(IDMap)
	if err := cloneHierarchicalRecordsWithFK(txApp, symbolEntriesColl, symbolEntries, "field", siteSymbolFieldMap, "parent", symbolEntryMap); err != nil {
		return nil, err
	}

	// 8. Clone page_types
	pageTypes, err := pb.FindRecordsByFilter("page_types", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageTypesColl, _ := txApp.FindCollectionByNameOrId("page_types")
	for _, pt := range pageTypes {
		rec := core.NewRecord(pageTypesColl)
		copyRecordFieldsFromRecord(rec, pt, pageTypesColl)
		rec.Set("site", newSite.Id)
		if err := txApp.Save(rec); err != nil {
			return nil, err
		}
		pageTypeMap[pt.Id] = rec.Id
	}

	// 9. Clone page_type_fields (hierarchical)
	pageTypeFields, err := pb.FindRecordsByFilter("page_type_fields", "page_type.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageTypeFieldsColl, _ := txApp.FindCollectionByNameOrId("page_type_fields")
	if err := cloneHierarchicalRecordsWithFK(txApp, pageTypeFieldsColl, pageTypeFields, "page_type", pageTypeMap, "parent", pageTypeFieldMap); err != nil {
		return nil, err
	}

	// 10. Clone page_type_entries (hierarchical)
	pageTypeEntries, err := pb.FindRecordsByFilter("page_type_entries", "field.page_type.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageTypeEntriesColl, _ := txApp.FindCollectionByNameOrId("page_type_entries")
	pageTypeEntryMap := make(IDMap)
	if err := cloneHierarchicalRecordsWithFK(txApp, pageTypeEntriesColl, pageTypeEntries, "field", pageTypeFieldMap, "parent", pageTypeEntryMap); err != nil {
		return nil, err
	}

	// 11. Clone page_type_symbols
	pageTypeSymbols, err := pb.FindRecordsByFilter("page_type_symbols", "page_type.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageTypeSymbolsColl, _ := txApp.FindCollectionByNameOrId("page_type_symbols")
	for _, pts := range pageTypeSymbols {
		newPageType := pageTypeMap[pts.GetString("page_type")]
		newSymbol := siteSymbolMap[pts.GetString("symbol")]
		if newPageType == "" || newSymbol == "" {
			continue
		}
		rec := core.NewRecord(pageTypeSymbolsColl)
		copyRecordFieldsFromRecord(rec, pts, pageTypeSymbolsColl)
		rec.Set("page_type", newPageType)
		rec.Set("symbol", newSymbol)
		if err := txApp.Save(rec); err != nil {
			return nil, err
		}
	}

	// 12. Clone page_type_sections
	pageTypeSections, err := pb.FindRecordsByFilter("page_type_sections", "page_type.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageTypeSectionsColl, _ := txApp.FindCollectionByNameOrId("page_type_sections")
	for _, pts := range pageTypeSections {
		newPageType := pageTypeMap[pts.GetString("page_type")]
		newSymbol := siteSymbolMap[pts.GetString("symbol")]
		if newPageType == "" || newSymbol == "" {
			return nil, errors.New("missing page_type or symbol for page_type_section")
		}
		rec := core.NewRecord(pageTypeSectionsColl)
		copyRecordFieldsFromRecord(rec, pts, pageTypeSectionsColl)
		rec.Set("page_type", newPageType)
		rec.Set("symbol", newSymbol)
		if err := txApp.Save(rec); err != nil {
			return nil, err
		}
		pageTypeSectionMap[pts.Id] = rec.Id
	}

	// 13. Clone page_type_section_entries (hierarchical - arbitrary depth)
	pageTypeSectionEntries, err := pb.FindRecordsByFilter("page_type_section_entries", "section.page_type.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageTypeSectionEntriesColl, _ := txApp.FindCollectionByNameOrId("page_type_section_entries")
	pageTypeSectionEntryMap := make(IDMap)
	createdPTSE := make(map[string]bool)
	for len(createdPTSE) < len(pageTypeSectionEntries) {
		madeProgress := false
		for _, rec := range pageTypeSectionEntries {
			if createdPTSE[rec.Id] {
				continue
			}
			oldParent := rec.GetString("parent")
			if oldParent != "" && pageTypeSectionEntryMap[oldParent] == "" {
				continue // Parent not yet created
			}
			newRec := core.NewRecord(pageTypeSectionEntriesColl)
			copyRecordFieldsFromRecord(newRec, rec, pageTypeSectionEntriesColl)
			newRec.Set("section", pageTypeSectionMap[rec.GetString("section")])
			newRec.Set("field", siteSymbolFieldMap[rec.GetString("field")])
			if oldParent == "" {
				newRec.Set("parent", "")
			} else {
				newRec.Set("parent", pageTypeSectionEntryMap[oldParent])
			}
			if err := txApp.Save(newRec); err != nil {
				return nil, err
			}
			pageTypeSectionEntryMap[rec.Id] = newRec.Id
			createdPTSE[rec.Id] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPTSE) < len(pageTypeSectionEntries) {
			cloneLog("[cloneSiteRecords] WARNING: %d page_type_section_entries could not be created", len(pageTypeSectionEntries)-len(createdPTSE))
			break
		}
	}

	// 14. Clone pages (hierarchical - arbitrary depth)
	pages, err := pb.FindRecordsByFilter("pages", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pagesColl, _ := txApp.FindCollectionByNameOrId("pages")
	createdPages := make(map[string]bool)
	for len(createdPages) < len(pages) {
		madeProgress := false
		for _, page := range pages {
			if createdPages[page.Id] {
				continue
			}
			oldParent := page.GetString("parent")
			if oldParent != "" && pageMap[oldParent] == "" {
				continue // Parent not yet created
			}
			rec := core.NewRecord(pagesColl)
			copyRecordFieldsFromRecord(rec, page, pagesColl)
			rec.Set("site", newSite.Id)
			rec.Set("page_type", pageTypeMap[page.GetString("page_type")])
			if oldParent == "" {
				rec.Set("parent", "")
			} else {
				rec.Set("parent", pageMap[oldParent])
			}
			rec.Set("compiled_html", nil)
			if err := txApp.Save(rec); err != nil {
				return nil, err
			}
			pageMap[page.Id] = rec.Id
			createdPages[page.Id] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPages) < len(pages) {
			cloneLog("[cloneSiteRecords] WARNING: %d pages could not be created", len(pages)-len(createdPages))
			break
		}
	}

	// 15. Clone page_entries (hierarchical - arbitrary depth)
	pageEntries, err := pb.FindRecordsByFilter("page_entries", "page.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageEntriesColl, _ := txApp.FindCollectionByNameOrId("page_entries")
	pageEntryMap := make(IDMap)
	createdPE := make(map[string]bool)
	for len(createdPE) < len(pageEntries) {
		madeProgress := false
		for _, rec := range pageEntries {
			if createdPE[rec.Id] {
				continue
			}
			oldParent := rec.GetString("parent")
			if oldParent != "" && pageEntryMap[oldParent] == "" {
				continue // Parent not yet created
			}
			newRec := core.NewRecord(pageEntriesColl)
			copyRecordFieldsFromRecord(newRec, rec, pageEntriesColl)
			newRec.Set("page", pageMap[rec.GetString("page")])
			newRec.Set("field", pageTypeFieldMap[rec.GetString("field")])
			if oldParent == "" {
				newRec.Set("parent", "")
			} else {
				newRec.Set("parent", pageEntryMap[oldParent])
			}
			if err := txApp.Save(newRec); err != nil {
				return nil, err
			}
			pageEntryMap[rec.Id] = newRec.Id
			createdPE[rec.Id] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPE) < len(pageEntries) {
			cloneLog("[cloneSiteRecords] WARNING: %d page_entries could not be created", len(pageEntries)-len(createdPE))
			break
		}
	}

	// 16. Clone page_sections
	pageSections, err := pb.FindRecordsByFilter("page_sections", "page.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageSectionsColl, _ := txApp.FindCollectionByNameOrId("page_sections")
	for _, ps := range pageSections {
		rec := core.NewRecord(pageSectionsColl)
		copyRecordFieldsFromRecord(rec, ps, pageSectionsColl)
		rec.Set("page", pageMap[ps.GetString("page")])
		rec.Set("symbol", siteSymbolMap[ps.GetString("symbol")])
		if err := txApp.Save(rec); err != nil {
			return nil, err
		}
		pageSectionMap[ps.Id] = rec.Id
	}

	// 17. Clone page_section_entries (hierarchical - arbitrary depth)
	pageSectionEntries, err := pb.FindRecordsByFilter("page_section_entries", "section.page.site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, err
	}
	pageSectionEntriesColl, _ := txApp.FindCollectionByNameOrId("page_section_entries")
	pageSectionEntryMap := make(IDMap)
	createdPSE := make(map[string]bool)
	for len(createdPSE) < len(pageSectionEntries) {
		madeProgress := false
		for _, rec := range pageSectionEntries {
			if createdPSE[rec.Id] {
				continue
			}
			oldParent := rec.GetString("parent")
			if oldParent != "" && pageSectionEntryMap[oldParent] == "" {
				continue // Parent not yet created
			}
			newRec := core.NewRecord(pageSectionEntriesColl)
			copyRecordFieldsFromRecord(newRec, rec, pageSectionEntriesColl)
			newRec.Set("section", pageSectionMap[rec.GetString("section")])
			newRec.Set("field", siteSymbolFieldMap[rec.GetString("field")])
			if oldParent == "" {
				newRec.Set("parent", "")
			} else {
				newRec.Set("parent", pageSectionEntryMap[oldParent])
			}
			if err := txApp.Save(newRec); err != nil {
				return nil, err
			}
			pageSectionEntryMap[rec.Id] = newRec.Id
			createdPSE[rec.Id] = true
			madeProgress = true
		}
		if !madeProgress && len(createdPSE) < len(pageSectionEntries) {
			cloneLog("[cloneSiteRecords] WARNING: %d page_section_entries could not be created", len(pageSectionEntries)-len(createdPSE))
			break
		}
	}

	// 18. Update field configs with remapped references
	updateFieldConfigReferences(txApp, "site_fields", siteFieldMap, pageTypeFieldMap, pageTypeMap, siteFieldMap)
	updateFieldConfigReferences(txApp, "site_symbol_fields", siteSymbolFieldMap, pageTypeFieldMap, pageTypeMap, siteFieldMap)
	updateFieldConfigReferences(txApp, "page_type_fields", pageTypeFieldMap, pageTypeFieldMap, pageTypeMap, siteFieldMap)

	// 19. Update entry values with remapped references
	updateEntryValueReferences(txApp, "site_entries", siteFieldMap, pageMap, uploadMap, siteEntryMap)
	updateEntryValueReferences(txApp, "site_symbol_entries", siteSymbolFieldMap, pageMap, uploadMap, symbolEntryMap)
	updateEntryValueReferences(txApp, "page_type_entries", pageTypeFieldMap, pageMap, uploadMap, pageTypeEntryMap)
	updateEntryValueReferences(txApp, "page_type_section_entries", siteSymbolFieldMap, pageMap, uploadMap, pageTypeSectionEntryMap)
	updateEntryValueReferences(txApp, "page_entries", pageTypeFieldMap, pageMap, uploadMap, pageEntryMap)
	updateEntryValueReferences(txApp, "page_section_entries", siteSymbolFieldMap, pageMap, uploadMap, pageSectionEntryMap)

	return newSite, nil
}

// Helper functions

func getString(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func copyRecordFields(rec *core.Record, data map[string]any, coll *core.Collection) {
	for _, field := range coll.Fields {
		name := field.GetName()
		if name != "id" && name != "created" && name != "updated" {
			if val, ok := data[name]; ok {
				rec.Set(name, val)
			}
		}
	}
}

func copyRecordFieldsFromRecord(dest *core.Record, src *core.Record, coll *core.Collection) {
	for _, field := range coll.Fields {
		name := field.GetName()
		if name != "id" && name != "created" && name != "updated" {
			dest.Set(name, src.Get(name))
		}
	}
}

func importHierarchicalRecords(app core.App, coll *core.Collection, records []map[string]any, siteField, siteId, parentField string, idMap IDMap) error {
	// Handle arbitrary depth by looping until all records are created
	created := make(map[string]bool)

	for len(created) < len(records) {
		madeProgress := false

		for _, data := range records {
			oldId := getString(data, "id")
			if created[oldId] {
				continue
			}

			oldParent := getString(data, parentField)
			if oldParent != "" && idMap[oldParent] == "" {
				continue // Parent not yet created
			}

			rec := core.NewRecord(coll)
			copyRecordFields(rec, data, coll)
			rec.Set(siteField, siteId)
			if oldParent == "" {
				rec.Set(parentField, "")
			} else {
				rec.Set(parentField, idMap[oldParent])
			}
			if err := app.Save(rec); err != nil {
				return err
			}
			idMap[oldId] = rec.Id
			created[oldId] = true
			madeProgress = true
		}

		if !madeProgress && len(created) < len(records) {
			cloneLog("[importHierarchicalRecords] WARNING: %d records could not be created (orphaned parents)", len(records)-len(created))
			break
		}
	}

	return nil
}

func importHierarchicalRecordsWithFK(app core.App, coll *core.Collection, records []map[string]any, fkField string, fkMap IDMap, parentField string, idMap IDMap) error {
	// Handle arbitrary depth by looping until all records are created
	// Keep track of which records we've created
	created := make(map[string]bool)

	for len(created) < len(records) {
		madeProgress := false

		for _, data := range records {
			oldId := getString(data, "id")
			if created[oldId] {
				continue // Already created
			}

			oldParent := getString(data, parentField)

			// Can create if: no parent, OR parent already created
			if oldParent != "" && idMap[oldParent] == "" {
				continue // Parent not yet created, skip for now
			}

			rec := core.NewRecord(coll)
			copyRecordFields(rec, data, coll)
			rec.Set(fkField, fkMap[getString(data, fkField)])
			if oldParent == "" {
				rec.Set(parentField, "")
			} else {
				rec.Set(parentField, idMap[oldParent])
			}
			if err := app.Save(rec); err != nil {
				return err
			}
			idMap[oldId] = rec.Id
			created[oldId] = true
			madeProgress = true
		}

		if !madeProgress && len(created) < len(records) {
			// No progress but still have uncreated records - orphaned references
			cloneLog("[importHierarchicalRecordsWithFK] WARNING: %d records could not be created (orphaned parents)", len(records)-len(created))
			break
		}
	}

	return nil
}

func cloneHierarchicalRecords(app core.App, coll *core.Collection, records []*core.Record, siteField, siteId, parentField string, idMap IDMap) error {
	// Handle arbitrary depth by looping until all records are created
	created := make(map[string]bool)

	for len(created) < len(records) {
		madeProgress := false

		for _, src := range records {
			if created[src.Id] {
				continue
			}

			oldParent := src.GetString(parentField)
			if oldParent != "" && idMap[oldParent] == "" {
				continue // Parent not yet created
			}

			rec := core.NewRecord(coll)
			copyRecordFieldsFromRecord(rec, src, coll)
			rec.Set(siteField, siteId)
			if oldParent == "" {
				rec.Set(parentField, "")
			} else {
				rec.Set(parentField, idMap[oldParent])
			}
			if err := app.Save(rec); err != nil {
				return err
			}
			idMap[src.Id] = rec.Id
			created[src.Id] = true
			madeProgress = true
		}

		if !madeProgress && len(created) < len(records) {
			cloneLog("[cloneHierarchicalRecords] WARNING: %d records could not be created (orphaned parents)", len(records)-len(created))
			break
		}
	}

	return nil
}

func cloneHierarchicalRecordsWithFK(app core.App, coll *core.Collection, records []*core.Record, fkField string, fkMap IDMap, parentField string, idMap IDMap) error {
	// Handle arbitrary depth by looping until all records are created
	created := make(map[string]bool)

	for len(created) < len(records) {
		madeProgress := false

		for _, src := range records {
			if created[src.Id] {
				continue
			}

			oldParent := src.GetString(parentField)
			if oldParent != "" && idMap[oldParent] == "" {
				continue // Parent not yet created
			}

			rec := core.NewRecord(coll)
			copyRecordFieldsFromRecord(rec, src, coll)
			rec.Set(fkField, fkMap[src.GetString(fkField)])
			if oldParent == "" {
				rec.Set(parentField, "")
			} else {
				rec.Set(parentField, idMap[oldParent])
			}
			if err := app.Save(rec); err != nil {
				return err
			}
			idMap[src.Id] = rec.Id
			created[src.Id] = true
			madeProgress = true
		}

		if !madeProgress && len(created) < len(records) {
			cloneLog("[cloneHierarchicalRecordsWithFK] WARNING: %d records could not be created (orphaned parents)", len(records)-len(created))
			break
		}
	}

	return nil
}

func updateFieldConfigReferences(app core.App, collName string, fieldMap, pageTypeFieldMap, pageTypeMap, siteFieldMap IDMap) {
	cloneLog("[updateFieldConfigReferences] Starting for collection: %s", collName)
	cloneLog("[updateFieldConfigReferences] siteFieldMap has %d entries", len(siteFieldMap))
	cloneLog("[updateFieldConfigReferences] pageTypeMap has %d entries:", len(pageTypeMap))
	for oldId, newId := range pageTypeMap {
		cloneLog("[updateFieldConfigReferences]   pageType: %s -> %s", oldId, newId)
	}

	_, err := app.FindCollectionByNameOrId(collName)
	if err != nil {
		cloneLog("[updateFieldConfigReferences] Collection %s not found: %v", collName, err)
		return
	}

	for oldId, newId := range fieldMap {
		rec, err := app.FindRecordById(collName, newId)
		if err != nil {
			cloneLog("[updateFieldConfigReferences] Could not find record %s: %v", newId, err)
			continue
		}

		fieldType := rec.GetString("type")
		fieldName := rec.GetString("name")

		// Get config - handle both map[string]any and types.JSONRaw
		config := rec.Get("config")
		var configMap map[string]any

		if fieldType == "site-field" {
			cloneLog("[updateFieldConfigReferences] Found site-field: name=%s, oldId=%s, newId=%s", fieldName, oldId, newId)
			cloneLog("[updateFieldConfigReferences] Config type: %T", config)
			cloneLog("[updateFieldConfigReferences] Config raw value: %+v", config)
		}

		switch c := config.(type) {
		case map[string]any:
			configMap = c
		case types.JSONRaw:
			if err := json.Unmarshal(c, &configMap); err != nil {
				// Log if this is a page or page-list field with empty config
				if fieldType == "page" || fieldType == "page-list" || fieldType == "page-field" {
					cloneLog("[updateFieldConfigReferences] WARNING: %s field '%s' has unparseable config: %v (raw: %s)", fieldType, fieldName, err, string(c))
				}
				continue
			}
		default:
			// Try to marshal and unmarshal to get a clean map
			configBytes, err := json.Marshal(config)
			if err != nil {
				if fieldType == "page" || fieldType == "page-list" || fieldType == "page-field" {
					cloneLog("[updateFieldConfigReferences] WARNING: %s field '%s' failed to marshal: %v", fieldType, fieldName, err)
				}
				continue
			}
			if err := json.Unmarshal(configBytes, &configMap); err != nil {
				if fieldType == "page" || fieldType == "page-list" || fieldType == "page-field" {
					cloneLog("[updateFieldConfigReferences] WARNING: %s field '%s' failed to unmarshal: %v", fieldType, fieldName, err)
				}
				continue
			}
		}

		if configMap == nil {
			if fieldType == "site-field" {
				cloneLog("[updateFieldConfigReferences] configMap is nil for site-field %s", fieldName)
			}
			continue
		}

		if fieldType == "site-field" {
			cloneLog("[updateFieldConfigReferences] Parsed configMap: %+v", configMap)
		}

		needsUpdate := false

		// Per field type
		if fieldType == "page" {
			cloneLog("[updateFieldConfigReferences] Found 'page' field %s, configMap=%+v", fieldName, configMap)
			if configMap["page_type"] != nil {
				oldPT, ok := configMap["page_type"].(string)
				cloneLog("[updateFieldConfigReferences] page_type=%v (type: %T, ok: %v)", configMap["page_type"], configMap["page_type"], ok)
				if ok && oldPT != "" {
					newPT := pageTypeMap[oldPT]
					cloneLog("[updateFieldConfigReferences] Looking up page_type %s -> %s", oldPT, newPT)
					if newPT != "" {
						configMap["page_type"] = newPT
						needsUpdate = true
					} else {
						cloneLog("[updateFieldConfigReferences] WARNING: No mapping for page_type %s", oldPT)
					}
				}
			} else {
				cloneLog("[updateFieldConfigReferences] WARNING: 'page' field %s has no page_type in config", fieldName)
			}
		} else if fieldType == "page-field" && configMap["field"] != nil {
			if oldField, ok := configMap["field"].(string); ok {
				if newField := pageTypeFieldMap[oldField]; newField != "" {
					configMap["field"] = newField
					needsUpdate = true
				}
			}
		} else if fieldType == "page-list" {
			cloneLog("[updateFieldConfigReferences] Found 'page-list' field %s, configMap=%+v", fieldName, configMap)
			if configMap["page_type"] != nil {
				oldPT, ok := configMap["page_type"].(string)
				cloneLog("[updateFieldConfigReferences] page_type=%v (type: %T, ok: %v)", configMap["page_type"], configMap["page_type"], ok)
				if ok && oldPT != "" {
					newPT := pageTypeMap[oldPT]
					cloneLog("[updateFieldConfigReferences] Looking up page_type %s -> %s", oldPT, newPT)
					if newPT != "" {
						configMap["page_type"] = newPT
						needsUpdate = true
					} else {
						cloneLog("[updateFieldConfigReferences] WARNING: No mapping for page_type %s", oldPT)
					}
				}
			} else {
				cloneLog("[updateFieldConfigReferences] WARNING: 'page-list' field %s has no page_type in config", fieldName)
			}
		} else if fieldType == "site-field" {
			cloneLog("[updateFieldConfigReferences] Processing site-field %s", fieldName)
			cloneLog("[updateFieldConfigReferences] configMap[field] = %v (type: %T)", configMap["field"], configMap["field"])

			if configMap["field"] != nil {
				if oldField, ok := configMap["field"].(string); ok {
					cloneLog("[updateFieldConfigReferences] Looking up old field ID: %s", oldField)
					newField := siteFieldMap[oldField]
					cloneLog("[updateFieldConfigReferences] Mapped to new field ID: %s", newField)

					if newField != "" {
						configMap["field"] = newField
						needsUpdate = true
						cloneLog("[updateFieldConfigReferences] Will update site-field %s config.field to %s", fieldName, newField)
					} else {
						cloneLog("[updateFieldConfigReferences] WARNING: No mapping found for old field ID %s", oldField)
					}
				} else {
					cloneLog("[updateFieldConfigReferences] configMap[field] is not a string: %T", configMap["field"])
				}
			} else {
				cloneLog("[updateFieldConfigReferences] configMap[field] is nil for site-field %s", fieldName)
			}
		}

		// All fields can have conditions
		if condition, ok := configMap["condition"].(map[string]any); ok {
			if oldField, ok := condition["field"].(string); ok {
				cloneLog("[updateFieldConfigReferences] Found condition.field=%s for field %s", oldField, fieldName)
				if newField := fieldMap[oldField]; newField != "" {
					cloneLog("[updateFieldConfigReferences] Remapping condition.field %s -> %s", oldField, newField)
					condition["field"] = newField
					configMap["condition"] = condition
					needsUpdate = true
				} else {
					cloneLog("[updateFieldConfigReferences] WARNING: No mapping for condition.field %s", oldField)
				}
			}
		}

		if needsUpdate {
			cloneLog("[updateFieldConfigReferences] Saving updated config for %s %s: %+v", collName, newId, configMap)
			rec.Set("config", configMap)
			if err := app.Save(rec); err != nil {
				cloneLog("[updateFieldConfigReferences] ERROR saving: %v", err)
			} else {
				// Verify the save
				verifyRec, _ := app.FindRecordById(collName, newId)
				if verifyRec != nil {
					cloneLog("[updateFieldConfigReferences] VERIFIED saved config: %+v", verifyRec.Get("config"))
				}
			}
		}
	}
}

func updateEntryValueReferences(app core.App, collName string, fieldMap, pageMap, uploadMap IDMap, entryMap IDMap) {
	cloneLog("[updateEntryValueReferences] Starting for collection: %s, pageMap has %d entries", collName, len(pageMap))

	// Only update entries we just created (in entryMap)
	for _, newId := range entryMap {
		rec, err := app.FindRecordById(collName, newId)
		if err != nil {
			continue
		}

		fieldId := rec.GetString("field")
		if fieldId == "" {
			continue
		}

		// Get the field to check its type
		var fieldType string
		for _, fieldColl := range []string{"site_fields", "site_symbol_fields", "page_type_fields"} {
			field, err := app.FindRecordById(fieldColl, fieldId)
			if err == nil {
				fieldType = field.GetString("type")
				break
			}
		}

		value := rec.Get("value")

		// Handle value - it might be map[string]any or types.JSONRaw
		var valueMap map[string]any
		switch v := value.(type) {
		case map[string]any:
			valueMap = v
		case types.JSONRaw:
			if err := json.Unmarshal(v, &valueMap); err != nil {
				// Not a map, might be a string value
				var strVal string
				if err := json.Unmarshal(v, &strVal); err == nil {
					// Handle page type with string value
					if fieldType == "page" && strVal != "" {
						cloneLog("[updateEntryValueReferences] Found page entry with string value: %s", strVal)
						if newPage := pageMap[strVal]; newPage != "" {
							cloneLog("[updateEntryValueReferences] Remapping page value %s -> %s", strVal, newPage)
							rec.Set("value", newPage)
							app.Save(rec)
						}
					}
					continue
				}
				continue
			}
		default:
			// Try direct string for page type
			if fieldType == "page" {
				if oldPage, ok := value.(string); ok && oldPage != "" {
					cloneLog("[updateEntryValueReferences] Found page entry with direct string value: %s", oldPage)
					if newPage := pageMap[oldPage]; newPage != "" {
						cloneLog("[updateEntryValueReferences] Remapping page value %s -> %s", oldPage, newPage)
						rec.Set("value", newPage)
						app.Save(rec)
					}
				}
			}
			continue
		}

		if valueMap == nil {
			continue
		}

		needsUpdate := false

		if fieldType == "image" && valueMap["upload"] != nil {
			if oldUpload, ok := valueMap["upload"].(string); ok {
				if newUpload := uploadMap[oldUpload]; newUpload != "" {
					valueMap["upload"] = newUpload
					needsUpdate = true
				}
			}
		} else if fieldType == "link" && valueMap["page"] != nil {
			oldPage, ok := valueMap["page"].(string)
			cloneLog("[updateEntryValueReferences] Found link entry, page=%v (type: %T, ok: %v)", valueMap["page"], valueMap["page"], ok)
			if ok && oldPage != "" {
				newPage := pageMap[oldPage]
				cloneLog("[updateEntryValueReferences] Looking up page %s -> %s", oldPage, newPage)
				if newPage != "" {
					valueMap["page"] = newPage
					needsUpdate = true
					cloneLog("[updateEntryValueReferences] Will update link entry page to %s", newPage)
				} else {
					cloneLog("[updateEntryValueReferences] WARNING: No mapping found for page %s", oldPage)
				}
			}
		} else if fieldType == "page" && valueMap != nil {
			// page type might store value as {"value": "pageId"} or just "pageId"
			if pageId, ok := valueMap["value"].(string); ok && pageId != "" {
				if newPage := pageMap[pageId]; newPage != "" {
					valueMap["value"] = newPage
					needsUpdate = true
				}
			}
		}

		if needsUpdate {
			cloneLog("[updateEntryValueReferences] Saving updated value for %s %s", collName, newId)
			rec.Set("value", valueMap)
			if err := app.Save(rec); err != nil {
				cloneLog("[updateEntryValueReferences] ERROR saving: %v", err)
			}
		}
	}
}
