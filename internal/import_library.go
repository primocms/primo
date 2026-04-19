package internal

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

type LibraryImportSummary struct {
	Groups int `json:"groups"`
	Blocks int `json:"blocks"`
}

type libraryBlockLocation struct {
	groupFolder string
	blockFolder string
}

func RegisterLibraryImportEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/palacms/import-library", func(e *core.RequestEvent) error {
			isLocal := IsLocalhost(e)
			if e.Auth == nil && !isLocal {
				return e.UnauthorizedError("Authentication required", nil)
			}

			if err := e.Request.ParseMultipartForm(32 << 20); err != nil {
				return e.BadRequestError("Failed to parse form", err)
			}

			file, _, err := e.Request.FormFile("file")
			if err != nil {
				return e.BadRequestError("No file uploaded", err)
			}
			defer file.Close()

			zipData, err := io.ReadAll(file)
			if err != nil {
				return e.InternalServerError("Failed to read file", err)
			}

			summary, err := processLibraryImport(pb, zipData)
			if err != nil {
				return e.InternalServerError("Library import failed: "+err.Error(), err)
			}

			return e.JSON(200, map[string]interface{}{
				"success": true,
				"summary": summary,
			})
		})
		return serveEvent.Next()
	})
	return nil
}

func processLibraryImport(pb *pocketbase.PocketBase, zipData []byte) (*LibraryImportSummary, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid ZIP file: %w", err)
	}

	files := make(map[string][]byte, len(reader.File))
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

	groupsByFolder, err := importLibraryGroups(pb, files)
	if err != nil {
		return nil, err
	}
	importedGroupIDs := make(map[string]bool, len(groupsByFolder))
	for _, group := range groupsByFolder {
		importedGroupIDs[group.Id] = true
	}

	blocks := findLibraryBlocks(files)
	importedSymbolIDs := make(map[string]bool, len(blocks))
	for _, block := range blocks {
		group := groupsByFolder[block.groupFolder]
		if group == nil {
			return nil, fmt.Errorf("no library group found for folder %q", block.groupFolder)
		}

		basePath := fmt.Sprintf("library/%s/%s", block.groupFolder, block.blockFolder)
		componentPath := basePath + "/component.svelte"
		fieldsPath := basePath + "/fields.yaml"
		contentPath := basePath + "/content.yaml"

		componentData := getFileData(files, componentPath)
		fieldsData := getFileData(files, fieldsPath)
		contentData := getFileData(files, contentPath)

		if componentData == nil && fieldsData == nil {
			continue
		}

		var blockMeta ExportedBlock
		if fieldsData != nil {
			if err := yaml.Unmarshal(fieldsData, &blockMeta); err != nil {
				return nil, fmt.Errorf("failed to parse library block fields for %s: %w", basePath, err)
			}
		}

		displayName := blockMeta.Name
		if displayName == "" {
			displayName = block.blockFolder
		}

		existing, err := findExistingLibrarySymbol(pb, group.Id, block.blockFolder, displayName, blockMeta.ID)
		if err != nil {
			return nil, err
		}

		if err := importLibraryBlock(pb, group, block.blockFolder, displayName, componentData, fieldsData, contentData, existing); err != nil {
			return nil, fmt.Errorf("failed to import library block %s/%s: %w", block.groupFolder, block.blockFolder, err)
		}
		symbol, err := findExistingLibrarySymbol(pb, group.Id, block.blockFolder, displayName, blockMeta.ID)
		if err != nil {
			return nil, err
		}
		if symbol != nil {
			importedSymbolIDs[symbol.Id] = true
		}
	}

	existingSymbols, err := pb.FindAllRecords("library_symbols")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch existing library symbols: %w", err)
	}
	for _, symbol := range existingSymbols {
		if importedSymbolIDs[symbol.Id] {
			continue
		}
		if err := deleteLibrarySymbol(pb, symbol); err != nil {
			return nil, fmt.Errorf("failed to delete stale library block %s: %w", symbol.GetString("name"), err)
		}
	}

	existingGroups, err := pb.FindAllRecords("library_symbol_groups")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch existing library groups: %w", err)
	}
	for _, group := range existingGroups {
		if importedGroupIDs[group.Id] {
			continue
		}
		if err := pb.Delete(group); err != nil {
			return nil, fmt.Errorf("failed to delete stale library group %s: %w", group.GetString("name"), err)
		}
	}

	return &LibraryImportSummary{
		Groups: len(groupsByFolder),
		Blocks: len(blocks),
	}, nil
}

func importLibraryGroups(pb *pocketbase.PocketBase, files map[string][]byte) (map[string]*core.Record, error) {
	existingGroups, err := pb.FindAllRecords("library_symbol_groups")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch library groups: %w", err)
	}

	existingByID := make(map[string]*core.Record, len(existingGroups))
	existingByName := make(map[string]*core.Record, len(existingGroups))
	for _, group := range existingGroups {
		existingByID[group.Id] = group
		existingByName[group.GetString("name")] = group
	}

	groupFolders := findLibraryGroupFolders(files)
	exportedGroups := make([]ExportedLibraryGroup, 0, len(groupFolders))

	if groupsData := getFileData(files, "library/groups.yaml"); groupsData != nil {
		if err := yaml.Unmarshal(groupsData, &exportedGroups); err != nil {
			return nil, fmt.Errorf("failed to parse library/groups.yaml: %w", err)
		}
	}

	exportedByFolder := make(map[string]ExportedLibraryGroup, len(exportedGroups))
	for _, group := range exportedGroups {
		folder := group.Folder
		if folder == "" {
			folder = sanitizeFilename(group.Name)
		}
		if folder == "" {
			folder = sanitizeFilename(group.ID)
		}
		if folder == "" {
			continue
		}
		group.Folder = folder
		exportedByFolder[folder] = group
	}

	for _, folder := range groupFolders {
		if _, ok := exportedByFolder[folder]; !ok {
			exportedByFolder[folder] = ExportedLibraryGroup{
				Name:   humanizeGroupID(folder),
				Folder: folder,
				Index:  len(exportedByFolder),
			}
		}
	}

	folders := make([]string, 0, len(exportedByFolder))
	for folder := range exportedByFolder {
		folders = append(folders, folder)
	}
	sort.Slice(folders, func(i, j int) bool {
		left := exportedByFolder[folders[i]]
		right := exportedByFolder[folders[j]]
		if left.Index == right.Index {
			return folders[i] < folders[j]
		}
		return left.Index < right.Index
	})

	groupsColl, err := pb.FindCollectionByNameOrId("library_symbol_groups")
	if err != nil {
		return nil, err
	}

	result := make(map[string]*core.Record, len(folders))
	for order, folder := range folders {
		groupData := exportedByFolder[folder]

		var group *core.Record
		if groupData.ID != "" {
			group = existingByID[groupData.ID]
		}
		if group == nil && groupData.Name != "" {
			group = existingByName[groupData.Name]
		}
		if group == nil {
			group = core.NewRecord(groupsColl)
			// Don't use hand-authored IDs - only IDs that exist in the DB are valid
		}

		group.Set("name", groupData.Name)
		if group.GetString("name") == "" {
			group.Set("name", humanizeGroupID(folder))
		}
		if groupData.Index != 0 || order == 0 {
			group.Set("index", groupData.Index)
		} else {
			group.Set("index", order)
		}

		if err := pb.Save(group); err != nil {
			return nil, err
		}

		result[folder] = group
	}

	return result, nil
}

func findLibraryGroupFolders(files map[string][]byte) []string {
	folders := make(map[string]bool)
	for filePath := range files {
		if !strings.HasPrefix(filePath, "library/") {
			continue
		}
		rest := strings.TrimPrefix(filePath, "library/")
		parts := strings.Split(rest, "/")
		if len(parts) < 2 {
			continue
		}
		if parts[0] == "" || parts[0] == "groups.yaml" {
			continue
		}
		folders[parts[0]] = true
	}

	result := make([]string, 0, len(folders))
	for folder := range folders {
		result = append(result, folder)
	}
	sort.Strings(result)
	return result
}

func findLibraryBlocks(files map[string][]byte) []libraryBlockLocation {
	blocks := make(map[string]libraryBlockLocation)
	for filePath := range files {
		if !strings.HasPrefix(filePath, "library/") {
			continue
		}
		rest := strings.TrimPrefix(filePath, "library/")
		parts := strings.Split(rest, "/")
		if len(parts) < 3 {
			continue
		}
		groupFolder := parts[0]
		blockFolder := parts[1]
		if groupFolder == "" || blockFolder == "" || groupFolder == "groups.yaml" {
			continue
		}
		key := groupFolder + "/" + blockFolder
		blocks[key] = libraryBlockLocation{
			groupFolder: groupFolder,
			blockFolder: blockFolder,
		}
	}

	result := make([]libraryBlockLocation, 0, len(blocks))
	for _, block := range blocks {
		result = append(result, block)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].groupFolder == result[j].groupFolder {
			return result[i].blockFolder < result[j].blockFolder
		}
		return result[i].groupFolder < result[j].groupFolder
	})
	return result
}

func findExistingLibrarySymbol(pb *pocketbase.PocketBase, groupID, folderName, displayName, exportedID string) (*core.Record, error) {
	if exportedID != "" {
		symbol, err := pb.FindRecordById("library_symbols", exportedID)
		if err == nil && symbol != nil {
			return symbol, nil
		}
	}

	groupSymbols, err := pb.FindRecordsByFilter("library_symbols", "group = {:group}", "", 0, 0, dbx.Params{"group": groupID})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch library symbols for group %s: %w", groupID, err)
	}

	for _, symbol := range groupSymbols {
		if symbol.GetString("name") == displayName {
			return symbol, nil
		}
	}
	for _, symbol := range groupSymbols {
		if sanitizeFilename(symbol.GetString("name")) == folderName {
			return symbol, nil
		}
	}

	return nil, nil
}

func importLibraryBlock(pb *pocketbase.PocketBase, group *core.Record, folderName, displayName string, componentData, fieldsData, contentData []byte, existing *core.Record) error {
	symbolsColl, err := pb.FindCollectionByNameOrId("library_symbols")
	if err != nil {
		return err
	}

	var blockMeta ExportedBlock
	if fieldsData != nil {
		if err := yaml.Unmarshal(fieldsData, &blockMeta); err != nil {
			return err
		}
	}

	var symbol *core.Record
	if existing != nil {
		symbol = existing
	} else {
		symbol = core.NewRecord(symbolsColl)
		// Don't use hand-authored IDs - only IDs that exist in the DB are valid
		// (existing != nil check above handles that case)
	}

	symbol.Set("group", group.Id)
	symbol.Set("name", displayName)

	if componentData != nil {
		code := string(componentData)
		html, css, js := parseComponent(code)
		symbol.Set("html", html)
		symbol.Set("css", css)
		symbol.Set("js", js)
	}

	if err := pb.Save(symbol); err != nil {
		return err
	}

	if fieldsData != nil {
		if err := importLibraryBlockFields(pb, symbol, blockMeta.Fields); err != nil {
			return err
		}
	}

	if contentData != nil {
		if err := importLibraryBlockContent(pb, symbol, contentData); err != nil {
			return err
		}
	} else {
		fields, _ := pb.FindRecordsByFilter("library_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})
		for _, field := range fields {
			existingEntries, _ := pb.FindRecordsByFilter("library_symbol_entries", "field = {:field}", "", 0, 0, dbx.Params{"field": field.Id})
			for _, entry := range existingEntries {
				pb.Delete(entry)
			}
		}
	}

	_ = folderName
	return nil
}

func importLibraryBlockFields(pb *pocketbase.PocketBase, symbol *core.Record, nestedFields []map[string]interface{}) error {
	fields := flattenSubfields(nestedFields, "")

	fieldsColl, err := pb.FindCollectionByNameOrId("library_symbol_fields")
	if err != nil {
		return err
	}

	existingFields, _ := pb.FindRecordsByFilter("library_symbol_fields", "symbol = {:symbol}", "", 0, 0, dbx.Params{"symbol": symbol.Id})

	existingByID := make(map[string]*core.Record, len(existingFields))
	for _, field := range existingFields {
		existingByID[field.Id] = field
	}

	existingByCompositeKey := make(map[string]*core.Record, len(existingFields))
	for _, field := range existingFields {
		if compositeKey := buildBlockFieldCompositeKey(field, existingByID); compositeKey != "" {
			existingByCompositeKey[compositeKey] = field
		}
	}

	fieldKeyToRecord := make(map[string]*core.Record, len(fields)*2)
	fieldsWithParent := make([]struct {
		field     *core.Record
		parentKey string
	}, 0)
	importedFieldIDs := make(map[string]bool, len(fields))

	for i, fieldData := range fields {
		fieldKey := getString(fieldData, "name")
		if fieldKey == "" {
			continue
		}

		parentKey := getString(fieldData, "parent")
		compositeKey := fieldKey
		if parentKey != "" {
			compositeKey = parentKey + "/" + fieldKey
		}

		var field *core.Record
		exportedFieldID := getExportedID(fieldData)
		if exportedFieldID != "" {
			field = existingByID[exportedFieldID]
		}
		if field == nil {
			field = existingByCompositeKey[compositeKey]
		}
		if field != nil && field.GetString("symbol") != symbol.Id {
			field = nil
		}
		if field == nil {
			field = core.NewRecord(fieldsColl)
			// Don't use hand-authored IDs - only IDs found in existingByID are valid
			field.Set("symbol", symbol.Id)
		}

		field.Set("key", fieldKey)
		field.Set("label", getString(fieldData, "label"))
		field.Set("type", getString(fieldData, "type"))
		field.Set("index", i)

		config, _ := fieldData["config"]
		if normalizedConfig, ok := normalizeImportedFieldConfig(config); ok {
			field.Set("config", normalizedConfig)
		} else {
			field.Set("config", nil)
		}

		if err := pb.Save(field); err != nil {
			return err
		}
		importedFieldIDs[field.Id] = true

		fieldKeyToRecord[fieldKey] = field
		fieldKeyToRecord[compositeKey] = field

		if parentKey != "" {
			fieldsWithParent = append(fieldsWithParent, struct {
				field     *core.Record
				parentKey string
			}{field: field, parentKey: parentKey})
		}
	}

	for _, item := range fieldsWithParent {
		parentRecord := fieldKeyToRecord[item.parentKey]
		if parentRecord == nil {
			continue
		}
		item.field.Set("parent", parentRecord.Id)
		if err := pb.Save(item.field); err != nil {
			return err
		}
	}

	staleFields := make([]*core.Record, 0)
	fieldByID := make(map[string]*core.Record, len(existingFields))
	for _, field := range existingFields {
		fieldByID[field.Id] = field
		if !importedFieldIDs[field.Id] {
			staleFields = append(staleFields, field)
		}
	}

	sort.Slice(staleFields, func(i, j int) bool {
		return fieldDepth(staleFields[i], fieldByID) > fieldDepth(staleFields[j], fieldByID)
	})

	for _, field := range staleFields {
		existingEntries, _ := pb.FindRecordsByFilter("library_symbol_entries", "field = {:field}", "", 0, 0, dbx.Params{"field": field.Id})
		for _, entry := range existingEntries {
			if err := pb.Delete(entry); err != nil {
				return err
			}
		}
		if err := pb.Delete(field); err != nil {
			return err
		}
	}

	return nil
}

func importLibraryBlockContent(pb *pocketbase.PocketBase, symbol *core.Record, data []byte) error {
	var contentMap map[string]interface{}
	err := yaml.Unmarshal(data, &contentMap)
	if err != nil {
		return err
	}

	fields, _ := pb.FindRecordsByFilter("library_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})
	fieldByKey := make(map[string]*core.Record, len(fields))
	fieldsByParent := make(map[string][]*core.Record)
	for _, field := range fields {
		fieldByKey[field.GetString("key")] = field
		parentID := field.GetString("parent")
		if parentID != "" {
			fieldsByParent[parentID] = append(fieldsByParent[parentID], field)
		}
	}

	entriesColl, err := pb.FindCollectionByNameOrId("library_symbol_entries")
	if err != nil {
		return err
	}

	for _, field := range fields {
		existingEntries, _ := pb.FindRecordsByFilter("library_symbol_entries", "field = {:field}", "", 0, 0, dbx.Params{"field": field.Id})
		for _, entry := range existingEntries {
			pb.Delete(entry)
		}
	}

	for fieldKey, value := range contentMap {
		field := fieldByKey[fieldKey]
		if field == nil {
			continue
		}
		parentID := field.GetString("parent")
		if parentID != "" {
			if _, hasParent := fieldByKey[getFieldKeyById(fields, parentID)]; hasParent {
				continue
			}
		}
		if err := importSymbolContentField(pb, entriesColl, field, value, "", 0, fieldsByParent, fieldByKey, nil); err != nil {
			return err
		}
	}

	return nil
}

func fieldDepth(field *core.Record, fieldByID map[string]*core.Record) int {
	depth := 0
	current := field
	seen := map[string]bool{}
	for current != nil {
		parentID := current.GetString("parent")
		if parentID == "" || seen[parentID] {
			break
		}
		seen[parentID] = true
		parent := fieldByID[parentID]
		if parent == nil {
			break
		}
		depth++
		current = parent
	}
	return depth
}

func deleteLibrarySymbol(pb *pocketbase.PocketBase, symbol *core.Record) error {
	fields, err := pb.FindRecordsByFilter("library_symbol_fields", "symbol = {:symbol}", "", 0, 0, dbx.Params{"symbol": symbol.Id})
	if err != nil {
		return err
	}

	fieldByID := make(map[string]*core.Record, len(fields))
	for _, field := range fields {
		fieldByID[field.Id] = field
	}
	sort.Slice(fields, func(i, j int) bool {
		return fieldDepth(fields[i], fieldByID) > fieldDepth(fields[j], fieldByID)
	})

	for _, field := range fields {
		entries, _ := pb.FindRecordsByFilter("library_symbol_entries", "field = {:field}", "", 0, 0, dbx.Params{"field": field.Id})
		for _, entry := range entries {
			if err := pb.Delete(entry); err != nil {
				return err
			}
		}
		if err := pb.Delete(field); err != nil {
			return err
		}
	}

	return pb.Delete(symbol)
}
