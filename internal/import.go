package internal

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
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

// ImportResult contains the diff and created IDs for writing back to files
type ImportResult struct {
	Diff       *ImportDiff                       `json:"diff"`
	CreatedIDs map[string]map[string]interface{} `json:"created_ids"`
}

func RegisterImportEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		// Preview endpoint - shows what would change
		serveEvent.Router.POST("/api/palacms/import/{siteId}/preview", func(e *core.RequestEvent) error {
			return handleImport(pb, e, true)
		})

		// Apply endpoint - actually makes changes
		serveEvent.Router.POST("/api/palacms/import/{siteId}", func(e *core.RequestEvent) error {
			return handleImport(pb, e, false)
		})

		return serveEvent.Next()
	})
	return nil
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

	// Find the site or create it if it doesn't exist
	siteCreated := false
	site, err := pb.FindRecordById("sites", siteId)
	if err != nil {
		// Site doesn't exist - create it with the provided ID
		sitesColl, collErr := pb.FindCollectionByNameOrId("sites")
		if collErr != nil {
			return e.InternalServerError("Failed to find sites collection", collErr)
		}

		site = core.NewRecord(sitesColl)
		site.Set("id", siteId)
		site.Set("owner", e.Auth.Id)
		site.Set("name", "Imported Site")

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

	// Parse multipart form
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
	})
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

	diff := &ImportDiff{
		Blocks:    ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
		PageTypes: ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
		Pages:     ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
		Site:      ImportDiffSection{Added: []string{}, Modified: []string{}, Deleted: []string{}},
	}

	// Track created IDs for writing back to files
	createdIDs := make(map[string]map[string]interface{})

	siteId := site.Id

	// Get existing data for comparison
	existingSymbols, _ := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	existingSymbolsByName := make(map[string]*core.Record)
	for _, s := range existingSymbols {
		existingSymbolsByName[s.GetString("name")] = s
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

	// Build page type name -> ID map for resolving page-list references
	// First, import page types so they exist, then build the map
	pageTypeNameToId := make(map[string]string)
	pageTypeDirs := findDirectories(files, "page-types/")
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

		// Read layout.yaml if it exists
		layoutPath := fmt.Sprintf("page-types/%s/layout.yaml", ptName)
		var layoutData *ExportedLayout
		if layoutBytes, ok := files[layoutPath]; ok {
			var layout ExportedLayout
			if err := yaml.Unmarshal(layoutBytes, &layout); err == nil {
				layoutData = &layout
			}
		}

		// Find existing page type by name or folder
		existingPt, _ := pb.FindFirstRecordByFilter("page_types", "site = {:site} AND name = {:name}", dbx.Params{"site": siteId, "name": ptData.Name})
		if existingPt == nil {
			allPts, _ := pb.FindRecordsByFilter("page_types", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
			for _, candidate := range allPts {
				if sanitizeFilename(candidate.GetString("name")) == ptName {
					existingPt = candidate
					break
				}
			}
		}

		if !previewOnly {
			if err := importPageType(pb, site, ptData, existingPt, nil, layoutData); err != nil {
				return nil, fmt.Errorf("failed to import page type %s: %w", ptData.Name, err)
			}
		}

		// Build map after import - find the page type by name
		pt, _ := pb.FindFirstRecordByFilter("page_types", "site = {:site} AND name = {:name}", dbx.Params{"site": siteId, "name": ptData.Name})
		if pt != nil {
			pageTypeNameToId[ptName] = pt.Id                             // folder name -> ID
			pageTypeNameToId[ptData.Name] = pt.Id                        // display name -> ID
			pageTypeNameToId[sanitizeFilename(ptData.Name)] = pt.Id      // sanitized name -> ID
		}
	}

	// Process blocks
	blockDirs := findDirectories(files, "blocks/")
	folderToDisplayName := make(map[string]string)
	for _, blockName := range blockDirs {
		componentPath := fmt.Sprintf("blocks/%s/component.svelte", blockName)
		fieldsPath := fmt.Sprintf("blocks/%s/fields.yaml", blockName)
		contentPathYaml := fmt.Sprintf("blocks/%s/content.yaml", blockName)
		contentPathJson := fmt.Sprintf("blocks/%s/content.json", blockName)

		componentData := files[componentPath]
		fieldsData := files[fieldsPath]
		// Prefer YAML, fall back to JSON for backwards compatibility
		contentData := files[contentPathYaml]
		if contentData == nil {
			contentData = files[contentPathJson]
		}
		contentIsYaml := files[contentPathYaml] != nil

		if componentData == nil && fieldsData == nil {
			continue
		}

		// Parse fields.yaml to get the original name
		var blockMeta ExportedBlock
		if fieldsData != nil {
			yaml.Unmarshal(fieldsData, &blockMeta)
		}

		displayName := blockMeta.Name
		if displayName == "" {
			displayName = blockName
		}
		folderToDisplayName[blockName] = displayName

		existing := existingSymbolsByName[displayName]
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
			// Check if modified - compare against combined html+css
			existingHtml := existing.GetString("html")
			existingCss := existing.GetString("css")
			existingCode := existingHtml + "\n\n<style>\n" + existingCss + "\n</style>"
			if componentData != nil && string(componentData) != existingCode {
				diff.Blocks.Modified = append(diff.Blocks.Modified, displayName)
			}
		}

		if !previewOnly {
			blockId, err := importBlock(pb, site, blockName, displayName, componentData, fieldsData, contentData, contentIsYaml, existing, pathToPageId, siteFieldKeyToId, pageTypeNameToId)
			if err != nil {
				return nil, fmt.Errorf("failed to import block %s: %w", blockName, err)
			}

			// Track created block ID
			fieldsPath := fmt.Sprintf("blocks/%s/fields.yaml", blockName)
			createdIDs[fieldsPath] = map[string]interface{}{
				"_id": blockId,
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
		existingPt, _ := pb.FindFirstRecordByFilter("page_types", "site = {:site} AND name = {:name}", dbx.Params{"site": siteId, "name": ptData.Name})
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
		// Note: actual import happens earlier to resolve page-list references
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
		pageId, err := importPage(pb, site, homepageInfo.data, homepageInfo.existing, folderToDisplayName, "", "")
		if err != nil {
			return nil, fmt.Errorf("failed to import homepage %s: %w", homepageInfo.path, err)
		}
		homepageId = pageId
		pathToId["index"] = pageId

		// Track created page ID
		createdIDs["pages/index.yaml"] = map[string]interface{}{
			"_id": pageId,
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

				// Look up the parent page ID
				if pid, ok := pathToId[parentPath]; ok {
					parentId = pid
				}
			} else {
				// Root-level pages should have homepage as parent
				if homepageId != "" {
					parentId = homepageId
				}
			}

			pageId, err := importPage(pb, site, info.data, info.existing, folderToDisplayName, parentId, info.path)
			if err != nil {
				return nil, fmt.Errorf("failed to import page %s: %w", info.path, err)
			}

			// Store the page ID for children to reference
			pathToId[info.path] = pageId

			// Track created page ID
			pagePath := "pages/" + info.path + ".yaml"
			createdIDs[pagePath] = map[string]interface{}{
				"_id": pageId,
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
		if err := validateHeadSvelte(headHtml); err != nil {
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
	}, nil
}

func validateHeadSvelte(data []byte) error {
	tokenizer := html.NewTokenizer(bytes.NewReader(data))

	for {
		tokenType := tokenizer.Next()

		switch tokenType {
		case html.ErrorToken:
			if tokenizer.Err() == io.EOF {
				return nil
			}
			return fmt.Errorf("site/head.svelte has invalid head markup: %w", tokenizer.Err())
		case html.StartTagToken, html.SelfClosingTagToken:
			nameBytes, hasAttr := tokenizer.TagName()
			tagName := strings.ToLower(string(nameBytes))

			for hasAttr {
				_, _, moreAttr := tokenizer.TagAttr()
				hasAttr = moreAttr
			}

			if tagName == "svelte:head" {
				return fmt.Errorf("site/head.svelte contains <svelte:head>. This file is injected into <svelte:head>; remove the wrapper. Keep only head children such as <title>, <meta>, <link>, <script>, and <style>.")
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

func importBlock(pb *pocketbase.PocketBase, site *core.Record, folderName, displayName string, componentData, fieldsData, contentData []byte, contentIsYaml bool, existing *core.Record, pathToPageId map[string]string, siteFieldKeyToId map[string]string, pageTypeNameToId map[string]string) (string, error) {
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
		symbol.Set("name", displayName)
	}

	if componentData != nil {
		// Parse component.svelte to extract html, css, js
		code := string(componentData)
		html, css, js := parseComponent(code)
		symbol.Set("html", html)
		symbol.Set("css", css)
		symbol.Set("js", js)
	}

	if err := pb.Save(symbol); err != nil {
		return "", err
	}

	// Import fields if provided
	if fieldsData != nil {
		var blockMeta ExportedBlock
		if err := yaml.Unmarshal(fieldsData, &blockMeta); err != nil {
			return "", err
		}

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
		for i, fieldData := range blockMeta.Fields {
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
				// For page-list type, convert page_type name to page_type ID
				if fieldType == "page-list" {
					if configMap, ok := config.(map[string]interface{}); ok {
						if ptName, ok := configMap["page_type"].(string); ok && ptName != "" {
							if ptId, found := pageTypeNameToId[ptName]; found {
								configMap["page_type"] = ptId
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
func importPageSectionContentField(pb *pocketbase.PocketBase, entriesColl *core.Collection, sectionId string, field *core.Record, value interface{}, parentEntryId string, index int, fieldsByParent map[string][]*core.Record, fieldByKey map[string]*core.Record, pathToPageId map[string]string) error {
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

			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := itemMap[childKey] // May be nil if not in YAML, that's ok
				if err := importPageSectionContentField(pb, entriesColl, sectionId, childField, childValue, itemEntry.Id, 0, fieldsByParent, fieldByKey, pathToPageId); err != nil {
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
		childFields := fieldsByParent[fieldId]
		groupMap, ok := value.(map[string]interface{})
		if ok {
			for _, childField := range childFields {
				childKey := childField.GetString("key")
				childValue := groupMap[childKey] // May be nil if not in YAML, that's ok
				if err := importPageSectionContentField(pb, entriesColl, sectionId, childField, childValue, groupEntry.Id, 0, fieldsByParent, fieldByKey, pathToPageId); err != nil {
					return err
				}
			}
		}

	default:
		// Simple field (text, image, link, select, etc.)
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

func importPage(pb *pocketbase.PocketBase, site *core.Record, pageData ExportedPage, existing *core.Record, folderToDisplayName map[string]string, parentId string, pagePath string) (string, error) {
	pagesColl, err := pb.FindCollectionByNameOrId("pages")
	if err != nil {
		return "", err
	}

	var page *core.Record
	if existing != nil {
		page = existing
	} else {
		page = core.NewRecord(pagesColl)
		page.Set("site", site.Id)
	}

	// Derive slug from file path (last segment)
	// e.g., "menu" -> "menu", "about/team" -> "team", "" -> ""
	slug := pagePath
	if lastSlash := strings.LastIndex(pagePath, "/"); lastSlash >= 0 {
		slug = pagePath[lastSlash+1:]
	}

	page.Set("name", pageData.Name)
	page.Set("slug", slug)
	page.Set("parent", parentId)

	// Find page type by name or slug-style name
	if pageData.PageType != "" {
		// Try exact name match first
		pt, err := pb.FindFirstRecordByFilter("page_types", "site = {:site} AND name = {:name}", dbx.Params{"site": site.Id, "name": pageData.PageType})
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
		return "", err
	}

	// Import page-type field values (page_entries)
	if len(pageData.Fields) > 0 && page.GetString("page_type") != "" {
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
			return "", err
		}

		for fieldKey, value := range pageData.Fields {
			fieldId := fieldByKey[fieldKey]
			if fieldId == "" {
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
				return "", err
			}
		}
	}

	// Import sections (blocks on the page)
	if len(pageData.Sections) > 0 {
		// Get existing sections
		existingSections, _ := pb.FindRecordsByFilter("page_sections", "page = {:page}", "+index", 0, 0, dbx.Params{"page": page.Id})

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
				continue
			}

			var section *core.Record
			if i < len(existingSections) {
				section = existingSections[i]
			} else {
				section = core.NewRecord(sectionsColl)
				section.Set("page", page.Id)
			}

			section.Set("symbol", symbolId)
			section.Set("index", i)

			if err := pb.Save(section); err != nil {
				return "", err
			}

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
						continue
					}
					// Only process top-level fields here
					parentId := field.GetString("parent")
					if parentId != "" {
						if _, hasParent := fieldByKey[getFieldKeyById(symbolFields, parentId)]; hasParent {
							continue // This field's parent is in this symbol, will be processed recursively
						}
					}
					if err := importPageSectionContentField(pb, entriesColl, section.Id, field, value, "", 0, fieldsByParent, fieldByKey, nil); err != nil {
						return "", err
					}
				}
			}
		}
	}

	return page.Id, nil
}

func importSiteFields(pb *pocketbase.PocketBase, site *core.Record, data []byte) error {
	var fields []map[string]interface{}
	if err := yaml.Unmarshal(data, &fields); err != nil {
		return err
	}

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

// importSiteFieldsWithMap imports site fields and returns a map of field key -> field ID
// This is used to resolve site-field references in blocks
func importSiteFieldsWithMap(pb *pocketbase.PocketBase, site *core.Record, data []byte) (map[string]string, error) {
	keyToId := make(map[string]string)

	var fields []map[string]interface{}
	if err := yaml.Unmarshal(data, &fields); err != nil {
		return keyToId, err
	}

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

func importPageType(pb *pocketbase.PocketBase, site *core.Record, ptData ExportedPageType, existing *core.Record, folderToDisplayName map[string]string, layoutData *ExportedLayout) error {
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

	if err := pb.Save(pageType); err != nil {
		return err
	}

	// Import page type fields
	if len(ptData.Fields) > 0 {
		fieldsColl, err := pb.FindCollectionByNameOrId("page_type_fields")
		if err != nil {
			return err
		}

		existingFields, _ := pb.FindRecordsByFilter("page_type_fields", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pageType.Id})
		existingByKey := make(map[string]*core.Record)
		for _, f := range existingFields {
			existingByKey[f.GetString("key")] = f
		}

		// Track field key -> record for parent resolution, and fields with parents
		fieldKeyToRecord := make(map[string]*core.Record)
		fieldsWithParent := make([]struct {
			field     *core.Record
			parentKey string
		}, 0)

		// First pass: Create/update all fields without parent relationships
		for i, fieldData := range ptData.Fields {
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
			field.Set("type", getString(fieldData, "type"))
			field.Set("index", i)

			// Read config (preferred) or options (backwards compatibility)
			ptFieldConfig, hasPtFieldConfig := fieldData["config"]
			if !hasPtFieldConfig {
				ptFieldConfig, hasPtFieldConfig = fieldData["options"]
			}
			if hasPtFieldConfig && ptFieldConfig != nil {
				field.Set("config", ptFieldConfig)
			}

			if err := pb.Save(field); err != nil {
				return err
			}

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
	}

	// Import page_type_symbols (allowed blocks on this page type)
	if len(ptData.AllowedBlocks) > 0 {
		ptSymbolsColl, err := pb.FindCollectionByNameOrId("page_type_symbols")
		if err != nil {
			return err
		}

		// Get all symbols for this site
		symbols, _ := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
		symbolByName := make(map[string]string)
		for _, s := range symbols {
			symbolByName[s.GetString("name")] = s.Id
			symbolByName[sanitizeFilename(s.GetString("name"))] = s.Id
		}
		// Also map folder names to symbol IDs
		for folderName, displayName := range folderToDisplayName {
			if symbolId := symbolByName[displayName]; symbolId != "" {
				symbolByName[folderName] = symbolId
			}
		}

		// Get existing page_type_symbols
		existingPtSymbols, _ := pb.FindRecordsByFilter("page_type_symbols", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pageType.Id})
		existingBySymbol := make(map[string]*core.Record)
		for _, pts := range existingPtSymbols {
			existingBySymbol[pts.GetString("symbol")] = pts
		}

		for i, blockName := range ptData.AllowedBlocks {
			symbolId := symbolByName[blockName]
			if symbolId == "" {
				continue
			}

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
	}

	// Import header/footer sections from layout.yaml
	if layoutData != nil && (len(layoutData.Header) > 0 || len(layoutData.Footer) > 0) {
		ptSectionsColl, err := pb.FindCollectionByNameOrId("page_type_sections")
		if err != nil {
			return err
		}

		// Get all symbols for this site
		symbols, _ := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
		symbolByName := make(map[string]string)
		symbolFields := make(map[string][]*core.Record) // symbolId -> fields
		for _, s := range symbols {
			symbolByName[s.GetString("name")] = s.Id
			symbolByName[sanitizeFilename(s.GetString("name"))] = s.Id
			// Fetch fields for this symbol
			fields, _ := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": s.Id})
			symbolFields[s.Id] = fields
		}
		// Also map folder names to symbol IDs
		for folderName, displayName := range folderToDisplayName {
			if symbolId := symbolByName[displayName]; symbolId != "" {
				symbolByName[folderName] = symbolId
			}
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

			// Import content entries for this section
			if sectionData.Content != nil {
				if err := importPageTypeSectionContent(pb, section, symbolFields[symbolId], sectionData.Content); err != nil {
					return err
				}
			}
		}

		// Import footer sections
		for i, sectionData := range layoutData.Footer {
			symbolId := symbolByName[sectionData.Block]
			if symbolId == "" {
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

			// Import content entries for this section
			if sectionData.Content != nil {
				if err := importPageTypeSectionContent(pb, section, symbolFields[symbolId], sectionData.Content); err != nil {
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
