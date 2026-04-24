package internal

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

// ExportedSite represents the top-level export metadata
type ExportedSite struct {
	Name       string `json:"name"`
	Host       string `json:"host"`
	SiteID     string `json:"site_id"`
	Group      string `json:"group,omitempty"`
	ExportedAt string `json:"exported_at"`
	Version    string `json:"version"`
}

// ExportedBlock represents a block's fields.yaml
type ExportedBlock struct {
	ID     string                   `json:"_id" yaml:"_id"`
	Name   string                   `json:"name" yaml:"name"`
	Fields []map[string]interface{} `json:"fields" yaml:"fields"`
}

// ExportedPageType represents a page type's config
type ExportedPageType struct {
	ID            string                   `json:"id" yaml:"id"`
	Name          string                   `json:"name" yaml:"name"`
	Icon          string                   `json:"icon,omitempty" yaml:"icon,omitempty"`
	Color         string                   `json:"color,omitempty" yaml:"color,omitempty"`
	AllowedBlocks []string                 `json:"allowed_blocks,omitempty" yaml:"allowed_blocks,omitempty"`
	Fields        []map[string]interface{} `json:"fields,omitempty" yaml:"fields,omitempty"`
}

// ExportedLayout represents a page type's layout (header/footer sections)
type ExportedLayout struct {
	Header []ExportedLayoutSection `yaml:"header,omitempty"`
	Footer []ExportedLayoutSection `yaml:"footer,omitempty"`
}

type ExportedLayoutSection struct {
	Block   string                 `yaml:"block"`
	Content map[string]interface{} `yaml:"content,omitempty"`
}

// ExportedPage represents a page's content
type ExportedPage struct {
	ID       string                   `json:"_id" yaml:"_id"`
	Name     string                   `json:"name" yaml:"name"`
	Slug     string                   `json:"slug,omitempty" yaml:"slug,omitempty"`
	PageType string                   `json:"page_type" yaml:"page_type"`
	Fields   map[string]interface{}   `json:"fields,omitempty" yaml:"fields,omitempty"`
	Sections []map[string]interface{} `json:"sections,omitempty" yaml:"sections,omitempty"`
	FilePath string                   `json:"-" yaml:"-"` // Internal: source file path for error messages
}

func normalizeExportedFieldConfig(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	if str, ok := value.(string); ok && strings.TrimSpace(str) == "" {
		return nil
	}

	return value
}

// ExportedSiteConfig represents site-wide configuration
type ExportedSiteConfig struct {
	Fields  []map[string]interface{} `json:"fields,omitempty"`
	Content map[string]interface{}   `json:"content,omitempty"`
}

func RegisterExportEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.GET("/api/palacms/export/{siteId}", func(e *core.RequestEvent) error {
			siteId := e.Request.PathValue("siteId")
			if siteId == "" {
				return e.BadRequestError("Missing site ID", nil)
			}

			// Allow unauthenticated access from localhost (for pala dev)
			isLocal := IsLocalhost(e)

			if e.Auth == nil && !isLocal {
				return e.UnauthorizedError("Authentication required", nil)
			}

			// Find the site
			site, err := pb.FindRecordById("sites", siteId)
			if err != nil {
				return e.NotFoundError("Site not found", err)
			}

			// Skip access check for localhost
			if !isLocal {
				info, err := e.RequestInfo()
				if err != nil {
					return e.InternalServerError("Failed to get request info", err)
				}
				canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().ViewRule)
				if !canAccess {
					return e.ForbiddenError("Access denied", nil)
				}
			}

			// Generate the export
			zipData, err := exportSiteToZip(pb, site)
			if err != nil {
				return e.InternalServerError("Export failed: "+err.Error(), err)
			}

			// Return as ZIP download
			e.Response.Header().Set("Content-Type", "application/zip")
			e.Response.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", sanitizeFilename(site.GetString("name"))))
			e.Response.Write(zipData)
			return nil
		})
		return serveEvent.Next()
	})
	return nil
}

func exportSiteToZip(pb *pocketbase.PocketBase, site *core.Record) ([]byte, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	siteId := site.Id

	// 1. Write site.yaml
	palaConfig := ExportedSite{
		Name:       site.GetString("name"),
		Host:       site.GetString("host"),
		SiteID:     siteId,
		Group:      site.GetString("group"),
		ExportedAt: site.GetString("updated"),
		Version:    "1.0",
	}
	if err := writeYAMLToZip(zw, "site.yaml", palaConfig); err != nil {
		return nil, err
	}

	// Pre-fetch site fields for ID -> name mapping (needed for site-field type resolution in blocks)
	siteFields, err := pb.FindRecordsByFilter("site_fields", "site = {:site}", "+index", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch site fields: %w", err)
	}
	siteFieldIdToKey := make(map[string]string)
	for _, field := range siteFields {
		key := field.GetString("key")
		if key == "" {
			key = field.GetString("name")
		}
		siteFieldIdToKey[field.Id] = key
	}

	// 2. Export blocks (site_symbols)
	symbols, err := pb.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch symbols: %w", err)
	}

	symbolNames := make(map[string]string) // id -> name for reference
	for _, symbol := range symbols {
		symbolName := sanitizeFilename(symbol.GetString("name"))
		if symbolName == "" {
			symbolName = symbol.Id
		}
		symbolNames[symbol.Id] = symbolName

		// Build component.svelte from html, css, js columns
		html := symbol.GetString("html")
		css := symbol.GetString("css")
		js := symbol.GetString("js")

		var code strings.Builder
		if js != "" {
			code.WriteString("<script>\n")
			code.WriteString(js)
			code.WriteString("\n</script>\n\n")
		}
		if html != "" {
			code.WriteString(html)
		}
		if css != "" {
			code.WriteString("\n\n<style>\n")
			code.WriteString(css)
			code.WriteString("\n</style>")
		}

		if code.Len() > 0 {
			if err := writeFileToZip(zw, fmt.Sprintf("blocks/%s/component.svelte", symbolName), []byte(code.String())); err != nil {
				return nil, err
			}
		}

		// Fetch and write fields.yaml
		fields, err := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch symbol fields: %w", err)
		}

		// Build field ID -> key map for parent resolution
		symbolFieldIdToKey := make(map[string]string)
		for _, f := range fields {
			key := f.GetString("key")
			if key == "" {
				key = f.GetString("name")
			}
			symbolFieldIdToKey[f.Id] = key
		}

		exportedFields := make([]map[string]interface{}, 0, len(fields))
		for _, field := range fields {
			exportedFields = append(exportedFields, fieldRecordToMap(field, symbolFieldIdToKey, siteFieldIdToKey))
		}

		blockMeta := ExportedBlock{
			ID:     symbol.Id,
			Name:   symbol.GetString("name"),
			Fields: nestSubfields(exportedFields),
		}
		if err := writeYAMLToZip(zw, fmt.Sprintf("blocks/%s/fields.yaml", symbolName), blockMeta); err != nil {
			return nil, err
		}

		// Fetch and write content.yaml (site_symbol_entries - default values)
		// Build field lookup maps for proper repeater/group handling
		symbolFieldById := make(map[string]*core.Record)
		symbolFieldsByParent := make(map[string][]*core.Record)
		for _, f := range fields {
			symbolFieldById[f.Id] = f
			parentId := f.GetString("parent")
			if parentId != "" {
				symbolFieldsByParent[parentId] = append(symbolFieldsByParent[parentId], f)
			}
		}

		// Fetch ALL entries for this symbol
		allSymbolEntries, err := pb.FindRecordsByFilter("site_symbol_entries", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})
		if err != nil {
			allSymbolEntries = []*core.Record{}
		}

		// Build entry lookup by parent
		symbolEntriesByParent := make(map[string][]*core.Record)
		for _, e := range allSymbolEntries {
			parentId := e.GetString("parent")
			symbolEntriesByParent[parentId] = append(symbolEntriesByParent[parentId], e)
		}

		// Sort entries by index within each parent group
		for parentId := range symbolEntriesByParent {
			entries := symbolEntriesByParent[parentId]
			sort.Slice(entries, func(i, j int) bool {
				return entries[i].GetInt("index") < entries[j].GetInt("index")
			})
		}

		// Build content using the same recursive logic as page sections
		symbolContent := buildSectionContent(symbolEntriesByParent[""], symbolFieldById, symbolFieldsByParent, symbolEntriesByParent)

		// Only write content.yaml if there are default values
		if len(symbolContent) > 0 {
			if err := writeYAMLToZip(zw, fmt.Sprintf("blocks/%s/content.yaml", symbolName), symbolContent); err != nil {
				return nil, err
			}
		}
	}

	// 3. Export page types
	pageTypes, err := pb.FindRecordsByFilter("page_types", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch page types: %w", err)
	}

	pageTypeNames := make(map[string]string) // id -> name
	for _, pt := range pageTypes {
		ptName := sanitizeFilename(pt.GetString("name"))
		if ptName == "" {
			ptName = pt.Id
		}
		pageTypeNames[pt.Id] = ptName

		// Fetch allowed blocks (page_type_symbols)
		ptSymbols, err := pb.FindRecordsByFilter("page_type_symbols", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pt.Id})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch page type symbols: %w", err)
		}

		allowedBlocks := make([]string, 0, len(ptSymbols))
		for _, pts := range ptSymbols {
			symbolId := pts.GetString("symbol")
			if name, ok := symbolNames[symbolId]; ok {
				allowedBlocks = append(allowedBlocks, name)
			}
		}

		// Fetch page type fields
		ptFields, err := pb.FindRecordsByFilter("page_type_fields", "page_type = {:pt}", "+index", 0, 0, dbx.Params{"pt": pt.Id})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch page type fields: %w", err)
		}

		// Build field ID -> key map for parent resolution
		ptFieldIdToKey := make(map[string]string)
		for _, f := range ptFields {
			key := f.GetString("key")
			if key == "" {
				key = f.GetString("name")
			}
			ptFieldIdToKey[f.Id] = key
		}

		exportedPTFields := make([]map[string]interface{}, 0, len(ptFields))
		for _, field := range ptFields {
			exportedPTFields = append(exportedPTFields, fieldRecordToMap(field, ptFieldIdToKey, siteFieldIdToKey))
		}

		// Write config.yaml in a stable field order so local dev doesn't keep reordering IDs.
		ptConfig := ExportedPageType{
			ID:            pt.Id,
			Name:          pt.GetString("name"),
			Icon:          pt.GetString("icon"),
			Color:         pt.GetString("color"),
			AllowedBlocks: allowedBlocks,
			Fields:        nestSubfields(exportedPTFields),
		}
		if err := writeYAMLToZip(zw, fmt.Sprintf("page-types/%s/config.yaml", ptName), ptConfig); err != nil {
			return nil, err
		}

		// Fetch header/footer slots (page_type_sections) with their content
		ptSections, err := pb.FindRecordsByFilter("page_type_sections", "page_type = {:pt}", "+index", 0, 0, dbx.Params{"pt": pt.Id})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch page type sections: %w", err)
		}

		headerSections := make([]map[string]interface{}, 0)
		footerSections := make([]map[string]interface{}, 0)
		for _, section := range ptSections {
			slot := section.GetString("zone")
			symbolId := section.GetString("symbol")
			blockName := symbolNames[symbolId]

			sectionData := map[string]interface{}{
				"block": blockName,
			}

			// Fetch content entries for this section
			entries, _ := pb.FindRecordsByFilter("page_type_section_entries", "section = {:section}", "", 0, 0, dbx.Params{"section": section.Id})
			if len(entries) > 0 {
				// Get fields for this symbol
				fields, _ := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbolId})
				fieldById := make(map[string]*core.Record)
				fieldsByParent := make(map[string][]*core.Record)
				for _, f := range fields {
					fieldById[f.Id] = f
					parentId := f.GetString("parent")
					fieldsByParent[parentId] = append(fieldsByParent[parentId], f)
				}

				// Build entries by parent map for repeater reconstruction
				entriesByParent := make(map[string][]*core.Record)
				topLevelEntries := make([]*core.Record, 0)
				for _, entry := range entries {
					parentId := entry.GetString("parent")
					if parentId == "" {
						topLevelEntries = append(topLevelEntries, entry)
					} else {
						entriesByParent[parentId] = append(entriesByParent[parentId], entry)
					}
				}

				// Use buildSectionContent to properly handle repeaters
				content := buildSectionContent(topLevelEntries, fieldById, fieldsByParent, entriesByParent)
				if len(content) > 0 {
					sectionData["content"] = content
				}
			}

			if slot == "header" {
				headerSections = append(headerSections, sectionData)
			} else if slot == "footer" {
				footerSections = append(footerSections, sectionData)
			}
		}

		// Write layout.yaml if there are header/footer sections
		if len(headerSections) > 0 || len(footerSections) > 0 {
			layout := map[string]interface{}{}
			if len(headerSections) > 0 {
				layout["header"] = headerSections
			}
			if len(footerSections) > 0 {
				layout["footer"] = footerSections
			}
			if err := writeYAMLToZip(zw, fmt.Sprintf("page-types/%s/layout.yaml", ptName), layout); err != nil {
				return nil, err
			}
		}
	}

	// 4. Export pages
	pages, err := pb.FindRecordsByFilter("pages", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch pages: %w", err)
	}

	// Build page hierarchy for path generation
	pageParents := make(map[string]string) // id -> parent_id
	pageSlugs := make(map[string]string)   // id -> slug
	pageRecords := make(map[string]*core.Record)
	pagesWithChildren := make(map[string]bool) // id -> has children
	for _, page := range pages {
		pageParents[page.Id] = page.GetString("parent")
		pageSlugs[page.Id] = page.GetString("slug")
		pageRecords[page.Id] = page
		// Mark parent as having children
		if parent := page.GetString("parent"); parent != "" {
			pagesWithChildren[parent] = true
		}
	}

	// Fetch page type fields for name lookups
	pageTypeFieldNames := make(map[string]string) // field id -> name
	for _, pt := range pageTypes {
		ptFields, err := pb.FindRecordsByFilter("page_type_fields", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pt.Id})
		if err == nil {
			for _, field := range ptFields {
				key := field.GetString("key")
				if key == "" {
					key = field.GetString("name")
				}
				pageTypeFieldNames[field.Id] = key
			}
		}
	}

	for _, page := range pages {
		// Build path from hierarchy
		path := buildPagePath(page.Id, pageParents, pageSlugs)

		// Fetch page entries (field values)
		pageEntries, err := pb.FindRecordsByFilter("page_entries", "page = {:page}", "", 0, 0, dbx.Params{"page": page.Id})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch page entries: %w", err)
		}

		fieldValues := make(map[string]interface{})
		for _, entry := range pageEntries {
			fieldId := entry.GetString("field")
			// Look up field name
			fieldName := pageTypeFieldNames[fieldId]
			if fieldName == "" {
				fieldName = fieldId // Fallback to ID if name not found
			}
			fieldValues[fieldName] = normalizeValue(entry.Get("value"))
		}

		// Fetch page sections (blocks on the page)
		pageSections, err := pb.FindRecordsByFilter("page_sections", "page = {:page}", "+index", 0, 0, dbx.Params{"page": page.Id})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch page sections: %w", err)
		}

		sections := make([]map[string]interface{}, 0, len(pageSections))
		for _, section := range pageSections {
			symbolId := section.GetString("symbol")
			blockName := symbolNames[symbolId]

			// Fetch section entries (content values)
			sectionEntries, err := pb.FindRecordsByFilter("page_section_entries", "section = {:section}", "", 0, 0, dbx.Params{"section": section.Id})
			if err != nil {
				return nil, fmt.Errorf("failed to fetch section entries: %w", err)
			}

			// Fetch symbol fields to understand types and hierarchy
			symbolFields, _ := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "", 0, 0, dbx.Params{"symbol": symbolId})

			// Build field lookup maps
			fieldById := make(map[string]*core.Record)
			fieldsByParent := make(map[string][]*core.Record) // parent field ID -> child fields
			for _, f := range symbolFields {
				fieldById[f.Id] = f
				parentId := f.GetString("parent")
				if parentId != "" {
					fieldsByParent[parentId] = append(fieldsByParent[parentId], f)
				}
			}

			// Build entry lookup maps
			entriesByParent := make(map[string][]*core.Record) // parent entry ID -> child entries ("" for top-level)
			for _, e := range sectionEntries {
				parentId := e.GetString("parent")
				entriesByParent[parentId] = append(entriesByParent[parentId], e)
			}

			// Sort entries by index within each parent group
			for parentId := range entriesByParent {
				entries := entriesByParent[parentId]
				sort.Slice(entries, func(i, j int) bool {
					return entries[i].GetInt("index") < entries[j].GetInt("index")
				})
			}

			// Build content recursively from top-level entries
			content := buildSectionContent(entriesByParent[""], fieldById, fieldsByParent, entriesByParent)

			sections = append(sections, map[string]interface{}{
				"_id":     section.Id,
				"block":   blockName,
				"content": content,
			})
		}

		// Determine page type name
		pageTypeName := ""
		ptId := page.GetString("page_type")
		if name, ok := pageTypeNames[ptId]; ok {
			pageTypeName = name
		}

		pageData := ExportedPage{
			ID:       page.Id,
			Name:     page.GetString("name"),
			PageType: pageTypeName,
			Fields:   fieldValues,
			Sections: sections,
		}

		// Determine filename
		// - Homepage (empty path) -> index.yaml
		// - Pages with children -> {path}/index.yaml
		// - Leaf pages -> {path}.yaml
		path = strings.TrimPrefix(path, "/")
		path = strings.TrimSuffix(path, "/")

		var filename string
		if path == "" {
			// Homepage
			filename = "pages/index.yaml"
		} else if pagesWithChildren[page.Id] {
			// Page has children, use folder structure
			filename = fmt.Sprintf("pages/%s/index.yaml", path)
		} else {
			// Leaf page
			filename = fmt.Sprintf("pages/%s.yaml", path)
		}

		if err := writeYAMLToZip(zw, filename, pageData); err != nil {
			return nil, err
		}
	}

	// 5. Export site fields and content
	// (siteFields already fetched at start for site-field type resolution)

	// Build field IDs list for entry fetching
	siteFieldIds := make([]string, 0, len(siteFields))
	for _, field := range siteFields {
		siteFieldIds = append(siteFieldIds, field.Id)
	}

	// Export site fields with parent resolution
	exportedSiteFields := make([]map[string]interface{}, 0, len(siteFields))
	for _, field := range siteFields {
		exportedSiteFields = append(exportedSiteFields, fieldRecordToMap(field, siteFieldIdToKey, nil))
	}

	if len(exportedSiteFields) > 0 {
		if err := writeYAMLToZip(zw, "site/fields.yaml", nestSubfields(exportedSiteFields)); err != nil {
			return nil, err
		}
	}

	// Site entries (content values) - use same approach as buildSectionContent
	siteContent := make(map[string]interface{})
	if len(siteFieldIds) > 0 {
		// Build field maps for nested structure reconstruction
		fieldById := make(map[string]*core.Record)
		fieldsByParent := make(map[string][]*core.Record)
		for _, field := range siteFields {
			fieldById[field.Id] = field
			parentId := field.GetString("parent")
			fieldsByParent[parentId] = append(fieldsByParent[parentId], field)
		}

		// Query ALL site entries at once
		allEntries, err := pb.FindRecordsByFilter("site_entries", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
		if err == nil && len(allEntries) > 0 {
			// Build entries by parent map
			entriesByParent := make(map[string][]*core.Record)
			topLevelEntries := make([]*core.Record, 0)
			for _, entry := range allEntries {
				parentId := entry.GetString("parent")
				if parentId == "" {
					topLevelEntries = append(topLevelEntries, entry)
				} else {
					entriesByParent[parentId] = append(entriesByParent[parentId], entry)
				}
			}

			// Use buildSectionContent to properly handle repeaters
			siteContent = buildSectionContent(topLevelEntries, fieldById, fieldsByParent, entriesByParent)
		}
	}

	if len(siteContent) > 0 {
		if err := writeYAMLToZip(zw, "site/content.yaml", siteContent); err != nil {
			return nil, err
		}
	}

	// Site head/foot HTML
	headHtml := site.GetString("head")
	if headHtml != "" {
		if err := writeFileToZip(zw, "site/head.svelte", []byte(headHtml)); err != nil {
			return nil, err
		}
	}

	footHtml := site.GetString("foot")
	if footHtml != "" {
		if err := writeFileToZip(zw, "site/foot.html", []byte(footHtml)); err != nil {
			return nil, err
		}
	}

	// 6. Generate AGENT.md
	readme := generateReadme(site, symbols, pageTypes, symbolNames, pageTypeNames)
	if err := writeFileToZip(zw, "AGENT.md", []byte(readme)); err != nil {
		return nil, err
	}

	// 7. Export uploads manifest
	uploads, err := pb.FindRecordsByFilter("site_uploads", "site = {:site}", "", 0, 0, dbx.Params{"site": siteId})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch uploads: %w", err)
	}

	if len(uploads) > 0 {
		manifest := make(map[string]interface{})
		for _, upload := range uploads {
			filename := upload.GetString("file")
			if filename != "" {
				manifest[filename] = map[string]interface{}{
					"id":  upload.Id,
					"url": fmt.Sprintf("/api/files/site_uploads/%s/%s", upload.Id, filename),
				}
			}
		}
		if err := writeJSONToZip(zw, "uploads/.manifest.json", manifest); err != nil {
			return nil, err
		}
	}

	// 8. Export ID manifest for round-trip import
	idManifest := map[string]interface{}{
		"blocks":           make(map[string]string),            // name -> id
		"block_fields":     make(map[string]map[string]string), // block_name -> field_name -> id
		"page_types":       make(map[string]string),            // name -> id
		"page_type_fields": make(map[string]map[string]string), // page_type_name -> field_name -> id
		"pages":            make(map[string]string),            // path -> id
		"site_fields":      make(map[string]string),            // name -> id
	}

	// Block IDs and their field IDs
	blockIds := idManifest["blocks"].(map[string]string)
	blockFieldIds := idManifest["block_fields"].(map[string]map[string]string)
	for _, symbol := range symbols {
		name := symbolNames[symbol.Id]
		blockIds[name] = symbol.Id

		// Get block field IDs
		fields, err := pb.FindRecordsByFilter("site_symbol_fields", "symbol = {:symbol}", "", 0, 0, dbx.Params{"symbol": symbol.Id})
		if err == nil {
			fieldMap := make(map[string]string)
			for _, field := range fields {
				key := field.GetString("key")
				if key == "" {
					key = field.GetString("name")
				}
				fieldMap[key] = field.Id
			}
			blockFieldIds[name] = fieldMap
		}
	}

	// Page type IDs and their field IDs
	ptIds := idManifest["page_types"].(map[string]string)
	ptFieldIds := idManifest["page_type_fields"].(map[string]map[string]string)
	for _, pt := range pageTypes {
		name := pageTypeNames[pt.Id]
		ptIds[name] = pt.Id

		// Get page type field IDs
		fields, err := pb.FindRecordsByFilter("page_type_fields", "page_type = {:pt}", "", 0, 0, dbx.Params{"pt": pt.Id})
		if err == nil {
			fieldMap := make(map[string]string)
			for _, field := range fields {
				key := field.GetString("key")
				if key == "" {
					key = field.GetString("name")
				}
				fieldMap[key] = field.Id
			}
			ptFieldIds[name] = fieldMap
		}
	}

	// Page IDs
	pageIds := idManifest["pages"].(map[string]string)
	for _, page := range pages {
		path := buildPagePath(page.Id, pageParents, pageSlugs)
		pageIds[path] = page.Id
	}

	// Site field IDs
	siteFieldManifest := idManifest["site_fields"].(map[string]string)
	for id, name := range siteFieldIdToKey {
		siteFieldManifest[name] = id
	}

	if err := writeJSONToZip(zw, ".pala/manifest.json", idManifest); err != nil {
		return nil, err
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func writeJSONToZip(zw *zip.Writer, filename string, data interface{}) error {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return writeFileToZip(zw, filename, jsonData)
}

func writeYAMLToZip(zw *zip.Writer, filename string, data interface{}) error {
	yamlData, err := yaml.Marshal(data)
	if err != nil {
		return err
	}
	return writeFileToZip(zw, filename, yamlData)
}

func writeFileToZip(zw *zip.Writer, filename string, data []byte) error {
	w, err := zw.Create(filename)
	if err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}

func sanitizeFilename(name string) string {
	// Replace problematic characters
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, ":", "-")
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ToLower(name)
	return name
}

func buildPagePath(pageId string, parents map[string]string, slugs map[string]string) string {
	var parts []string
	current := pageId

	for current != "" {
		slug := slugs[current]
		if slug != "" && slug != "index" {
			parts = append([]string{slug}, parts...)
		}
		current = parents[current]
	}

	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, "/")
}

func fieldRecordToMap(field *core.Record, fieldIdToKey map[string]string, siteFieldIdToKey map[string]string) map[string]interface{} {
	// Fields use "key" column for the field name
	name := field.GetString("key")

	fieldType := field.GetString("type")

	// Get config and ensure it's properly typed (PocketBase may return types.JSONRaw for JSON fields)
	var config interface{}
	rawConfig := field.Get("config")
	if rawConfig != nil {
		config = normalizeExportedFieldConfig(normalizeValue(rawConfig))
	}

	// For site-field type, convert the field ID reference to field name
	if fieldType == "site-field" && config != nil && siteFieldIdToKey != nil {
		if configMap, ok := config.(map[string]interface{}); ok {
			if fieldId, ok := configMap["field"].(string); ok && fieldId != "" {
				if fieldName, found := siteFieldIdToKey[fieldId]; found {
					// Create a copy with the name instead of ID
					newConfig := make(map[string]interface{})
					for k, v := range configMap {
						newConfig[k] = v
					}
					newConfig["field"] = fieldName
					config = newConfig
				}
			}
		}
	}

	result := map[string]interface{}{
		"name":  name,
		"label": field.GetString("label"),
		"type":  fieldType,
	}
	// Only include config if it has a value
	if config != nil {
		result["config"] = config
	}
	// Include field ID for page-field references (prefixed with _ to indicate system field)
	if field.Id != "" {
		result["_id"] = field.Id
	}
	// Include parent field (by key/name, not ID) for repeater children
	parentId := field.GetString("parent")
	if parentId != "" && fieldIdToKey != nil {
		result["__parent_id"] = parentId
		if parentKey, ok := fieldIdToKey[parentId]; ok {
			result["parent"] = parentKey
		}
	}
	return result
}

// nestSubfields converts a flat list of fields with "parent" references into a nested structure with "subfields"
func nestSubfields(flatFields []map[string]interface{}) []map[string]interface{} {
	// Build a map of parent field ID -> children so repeated field keys don't collapse nested trees.
	childrenByParent := make(map[string][]map[string]interface{})
	var topLevel []map[string]interface{}

	for _, field := range flatFields {
		parentID, hasParent := field["__parent_id"].(string)
		if hasParent && parentID != "" {
			childrenByParent[parentID] = append(childrenByParent[parentID], field)
		} else {
			topLevel = append(topLevel, field)
		}
	}

	// Recursively attach children as subfields
	var attachChildren func(fields []map[string]interface{})
	attachChildren = func(fields []map[string]interface{}) {
		for _, field := range fields {
			fieldID, _ := field["_id"].(string)
			if children, ok := childrenByParent[fieldID]; ok && len(children) > 0 {
				// Remove internal parent metadata from nested children before writing YAML.
				for _, child := range children {
					delete(child, "__parent_id")
					delete(child, "parent")
				}
				// Recursively process children to attach their own subfields
				attachChildren(children)
				field["subfields"] = children
			}

			delete(field, "__parent_id")
			delete(field, "parent")
		}
	}

	attachChildren(topLevel)
	return topLevel
}

func generateReadme(site *core.Record, symbols []*core.Record, pageTypes []*core.Record, symbolNames map[string]string, pageTypeNames map[string]string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# %s\n\n", site.GetString("name")))
	sb.WriteString("Pala site exported for local development.\n\n")

	sb.WriteString("## Structure\n\n")
	sb.WriteString("```\n")
	sb.WriteString("blocks/           # Svelte components with content fields\n")
	sb.WriteString("  {name}/\n")
	sb.WriteString("    component.svelte\n")
	sb.WriteString("    fields.yaml\n")
	sb.WriteString("    content.yaml  # Block-level defaults: sidebar + seed on insert. Does NOT cascade to existing page sections.\n")
	sb.WriteString("page-types/       # Page templates\n")
	sb.WriteString("  {name}/\n")
	sb.WriteString("    config.yaml\n")
	sb.WriteString("pages/            # Page content (YAML)\n")
	sb.WriteString("  index.yaml      # Homepage\n")
	sb.WriteString("  contact.yaml    # Leaf page (/contact)\n")
	sb.WriteString("  about/          # Section with children\n")
	sb.WriteString("    index.yaml    # /about\n")
	sb.WriteString("    team.yaml     # /about/team\n")
	sb.WriteString("site/             # Site-wide settings\n")
	sb.WriteString("  fields.yaml\n")
	sb.WriteString("  content.yaml\n")
	sb.WriteString("  head.svelte     # Optional head markup; no <svelte:head> wrapper\n")
	sb.WriteString(".pala/            # Internal metadata\n")
	sb.WriteString("```\n\n")

	sb.WriteString("## Site Head\n\n")
	sb.WriteString("`site/head.svelte` is injected into Primo's generated `<svelte:head>`.\n")
	sb.WriteString("Do not wrap it in `<svelte:head>`.\n")
	sb.WriteString("Use direct head children such as `<title>`, `<meta>`, `<link>`, `<script>`, and `<style>`.\n\n")

	sb.WriteString("## System IDs\n\n")
	sb.WriteString("Blocks, fields, pages, page types, and sections all have system-owned IDs (`_id` for most, `id` for page types).\n\n")
	sb.WriteString("- When creating a new entity, **omit the ID**. The dev server generates and writes it back on first sync.\n")
	sb.WriteString("- Do not invent or hand-author new IDs.\n")
	sb.WriteString("- Keep existing IDs stable when editing an entity.\n")
	sb.WriteString("- Duplicate IDs are treated as conflicts and may cause affected files to be skipped.\n\n")

	sb.WriteString("## Where Content Lives\n\n")
	sb.WriteString("Rendered page content comes from the section's `content:` in `pages/*.yaml` — not from the block's `content.yaml`.\n\n")
	sb.WriteString("- `blocks/{name}/content.yaml`: block-level defaults. Used for (1) values shown in the block's editor sidebar and (2) the initial `content:` seeded when the block is first added to a page in the editor.\n")
	sb.WriteString("- Defaults do NOT cascade. Once a section exists on a page, it reads from that section's `content:` in `pages/*.yaml`. Editing the block's `content.yaml` afterward does not change what an existing section renders.\n")
	sb.WriteString("- To add or change content on an existing page, edit the section's `content:` in `pages/*.yaml`, not the block's `content.yaml`.\n\n")

	sb.WriteString("## Creating Blocks\n\n")
	sb.WriteString("Each block needs two files:\n\n")
	sb.WriteString("**component.svelte** - Svelte 5 component:\n")
	sb.WriteString("```svelte\n")
	sb.WriteString("<h1>{headline}</h1>\n")
	sb.WriteString("{#if image?.url}\n")
	sb.WriteString("  <img src={image.url} alt={image.alt} />\n")
	sb.WriteString("{/if}\n\n")
	sb.WriteString("<style>\n")
	sb.WriteString("  h1 { font-size: 2rem; }\n")
	sb.WriteString("</style>\n")
	sb.WriteString("```\n\n")
	sb.WriteString("**Note:** Props are auto-injected from fields.yaml. No need to declare `$props()` - just use the field names directly in your template.\n\n")
	sb.WriteString("**fields.yaml** - Field definitions:\n")
	sb.WriteString("```yaml\n")
	sb.WriteString("name: Hero\n")
	sb.WriteString("fields:\n")
	sb.WriteString("  - name: headline\n")
	sb.WriteString("    label: Headline\n")
	sb.WriteString("    type: text\n")
	sb.WriteString("  - name: image\n")
	sb.WriteString("    label: Image\n")
	sb.WriteString("    type: image\n")
	sb.WriteString("```\n\n")
	sb.WriteString("**Note:** Field IDs are optional. They are auto-generated on import and exported back to the file.\n\n")

	sb.WriteString("## Field Types\n\n")

	sb.WriteString("### text\n")
	sb.WriteString("Single-line text input.\n")
	sb.WriteString("```svelte\n<h1>{headline}</h1>\n```\n\n")

	sb.WriteString("### rich-text\n")
	sb.WriteString("WYSIWYG editor. Outputs HTML.\n")
	sb.WriteString("```svelte\n{@html content}\n```\n\n")

	sb.WriteString("### markdown\n")
	sb.WriteString("Markdown editor. Outputs HTML.\n")
	sb.WriteString("```svelte\n{@html body}\n```\n\n")

	sb.WriteString("### image\n")
	sb.WriteString("Image upload. Returns `{ url, alt, width, height }`.\n")
	sb.WriteString("```svelte\n{#if image?.url}\n  <img src={image.url} alt={image.alt} />\n{/if}\n```\n\n")

	sb.WriteString("### link\n")
	sb.WriteString("URL with label. Returns `{ url, label }`.\n")
	sb.WriteString("```svelte\n{#if cta?.url}\n  <a href={cta.url}>{cta.label}</a>\n{/if}\n```\n\n")

	sb.WriteString("### url\n")
	sb.WriteString("Plain URL string.\n")
	sb.WriteString("```svelte\n<a href={website_url}>Visit</a>\n```\n\n")

	sb.WriteString("### icon\n")
	sb.WriteString("Icon picker. Returns SVG string.\n")
	sb.WriteString("```svelte\n{@html icon}\n```\n\n")

	sb.WriteString("### number\n")
	sb.WriteString("Numeric input.\n")
	sb.WriteString("```json\n{ \"name\": \"columns\", \"type\": \"number\", \"options\": { \"min\": 1, \"max\": 6 } }\n```\n\n")

	sb.WriteString("### switch\n")
	sb.WriteString("Boolean toggle.\n")
	sb.WriteString("```svelte\n{#if show_title}<h1>{title}</h1>{/if}\n```\n\n")

	sb.WriteString("### select\n")
	sb.WriteString("Dropdown selection.\n")
	sb.WriteString("```json\n{ \"name\": \"align\", \"type\": \"select\", \"options\": { \"choices\": [\"left\", \"center\", \"right\"] } }\n```\n")
	sb.WriteString("```svelte\n<div class=\"text-{align}\">{content}</div>\n```\n\n")

	sb.WriteString("### repeater\n")
	sb.WriteString("List of items with nested fields.\n")
	sb.WriteString("```yaml\n- name: features\n  type: repeater\n  subfields:\n    - name: title\n      type: text\n    - name: description\n      type: text\n```\n")
	sb.WriteString("```svelte\n{#each features as feature}\n  <div>\n    <h3>{feature.title}</h3>\n    <p>{feature.description}</p>\n  </div>\n{/each}\n```\n\n")

	sb.WriteString("### group\n")
	sb.WriteString("Nested object of fields.\n")
	sb.WriteString("```yaml\n- name: author\n  type: group\n  subfields:\n    - name: name\n      type: text\n    - name: avatar\n      type: image\n```\n")
	sb.WriteString("```svelte\n<div>{author.name}</div>\n{#if author.avatar?.url}<img src={author.avatar.url} />{/if}\n```\n\n")

	sb.WriteString("### page\n")
	sb.WriteString("Reference to another page. Returns page data with `_meta.url`.\n")
	sb.WriteString("```json\n{ \"name\": \"featured_post\", \"type\": \"page\", \"options\": { \"page_type\": \"blog-post\" } }\n```\n\n")

	sb.WriteString("### page-list\n")
	sb.WriteString("All pages of a type.\n")
	sb.WriteString("```json\n{ \"name\": \"posts\", \"type\": \"page-list\", \"options\": { \"page_type\": \"blog-post\" } }\n```\n\n")

	sb.WriteString("### page-field\n")
	sb.WriteString("Reference a field from the current page type.\n\n")

	sb.WriteString("### site-field\n")
	sb.WriteString("Reference a site-wide field.\n\n")

	sb.WriteString("### slider\n")
	sb.WriteString("Range slider for numeric values.\n")
	sb.WriteString("```json\n{ \"name\": \"opacity\", \"type\": \"slider\", \"options\": { \"min\": 0, \"max\": 100, \"step\": 10 } }\n```\n\n")

	sb.WriteString("### date\n")
	sb.WriteString("Date picker.\n\n")

	sb.WriteString("### info\n")
	sb.WriteString("Display-only text for editors (not rendered in component).\n\n")

	sb.WriteString("## Svelte 5 Syntax\n\n")
	sb.WriteString("Components use Svelte 5:\n")
	sb.WriteString("- `$state()` for reactive variables\n")
	sb.WriteString("- `$derived()` for computed values\n")
	sb.WriteString("- `$effect()` for side effects\n")
	sb.WriteString("- `onclick={handler}` not `on:click={handler}`\n\n")

	sb.WriteString("## Editor Context\n\n")
	sb.WriteString("Check if component is running in the CMS editor:\n")
	sb.WriteString("```svelte\n")
	sb.WriteString("let is_editor = $state(false)\n\n")
	sb.WriteString("if (typeof window !== 'undefined') {\n")
	sb.WriteString("\tis_editor = window.__PRIMO_CONTEXT__?.environment === 'editor'\n")
	sb.WriteString("}\n")
	sb.WriteString("```\n\n")
	sb.WriteString("Use this for:\n")
	sb.WriteString("- Disabling fixed/sticky positioning\n")
	sb.WriteString("- Skipping scroll/resize listeners\n")
	sb.WriteString("- Showing placeholder content\n\n")

	sb.WriteString("## Inline Editing (`data-key`)\n\n")
	sb.WriteString("The editor enables on-page editing (click a heading to change its text, click a link to change its URL/label) by matching rendered DOM elements back to their fields. Automatic matching is fragile — it fails when text has fallbacks, anchors wrap icons, or multiple elements share the same value.\n\n")
	sb.WriteString("**Always add `data-key=\"<field_name>\"` on the element bound to a field.** This makes the binding explicit and always editable in the CMS.\n\n")
	sb.WriteString("```svelte\n")
	sb.WriteString("<h1 data-key=\"headline\">{headline}</h1>\n")
	sb.WriteString("<p data-key=\"subheadline\">{subheadline}</p>\n\n")
	sb.WriteString("<!-- link fields: put data-key on the <a> -->\n")
	sb.WriteString("<a href={cta.url} data-key=\"cta\">\n")
	sb.WriteString("\t{cta.label || 'Get Started'}\n")
	sb.WriteString("\t<svg>...</svg>\n")
	sb.WriteString("</a>\n\n")
	sb.WriteString("<!-- image fields: put data-key on the <img> -->\n")
	sb.WriteString("<img src={hero_image.url} alt={hero_image.alt} data-key=\"hero_image\" />\n\n")
	sb.WriteString("<!-- repeater items: use the subfield name scoped to each item -->\n")
	sb.WriteString("{#each features as feature}\n")
	sb.WriteString("\t<div>\n")
	sb.WriteString("\t\t<h3 data-key=\"title\">{feature.title}</h3>\n")
	sb.WriteString("\t\t<p data-key=\"description\">{feature.description}</p>\n")
	sb.WriteString("\t</div>\n")
	sb.WriteString("{/each}\n")
	sb.WriteString("```\n\n")
	sb.WriteString("Rules:\n")
	sb.WriteString("- Add `data-key` to **every** element bound to a text, rich-text, markdown, link, image, icon, url, or number field.\n")
	sb.WriteString("- For links and images, put `data-key` on the `<a>` / `<img>` itself, not a wrapping div.\n")
	sb.WriteString("- For group/repeater subfields, `data-key` uses the subfield name (e.g. `data-key=\"title\"`), not a dotted path.\n")
	sb.WriteString("- An element without `data-key` may still be editable if its rendered text exactly matches the field value with no child content — don't rely on that.\n\n")

	sb.WriteString("## This Site\n\n")
	sb.WriteString("### Blocks\n\n")
	for _, symbol := range symbols {
		name := symbolNames[symbol.Id]
		sb.WriteString(fmt.Sprintf("- `%s` - %s\n", name, symbol.GetString("name")))
	}
	sb.WriteString("\n")

	sb.WriteString("### Page Types\n\n")
	for _, pt := range pageTypes {
		name := pageTypeNames[pt.Id]
		sb.WriteString(fmt.Sprintf("- `%s` - %s\n", name, pt.GetString("name")))
	}
	sb.WriteString("\n")

	sb.WriteString("## Best Practices\n\n")
	sb.WriteString("### Safe Field Access\n\n")
	sb.WriteString("Always handle potentially undefined fields:\n")
	sb.WriteString("```svelte\n")
	sb.WriteString("<!-- Images -->\n")
	sb.WriteString("{#if hero_image?.url}\n")
	sb.WriteString("  <img src={hero_image.url} alt={hero_image.alt} />\n")
	sb.WriteString("{/if}\n\n")
	sb.WriteString("<!-- Links -->\n")
	sb.WriteString("<a href={cta?.url || '#'}>{cta?.label || 'Learn More'}</a>\n\n")
	sb.WriteString("<!-- Repeaters -->\n")
	sb.WriteString("{#each features || [] as feature}\n")
	sb.WriteString("  <div>{feature.title}</div>\n")
	sb.WriteString("{/each}\n")
	sb.WriteString("```\n\n")

	sb.WriteString("## Workflow\n\n")
	sb.WriteString("1. Run `pala dev` to start the local preview server\n")
	sb.WriteString("2. Edit blocks, pages, or site settings - changes auto-sync to dev server\n")
	sb.WriteString("3. Run `pala push` to deploy changes to a live server (if connected)\n")

	return sb.String()
}

// normalizeValue converts []byte JSON values to their actual Go types
// PocketBase returns JSON field values as types.JsonRaw (a named []byte type),
// which YAML would marshal as integer arrays if not converted
func normalizeValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}

	// Use reflection to check for byte slice types that might not match []byte directly
	// This catches types.JSONRaw and any other named []byte types
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice && rv.Type().Elem().Kind() == reflect.Uint8 {
		// This is a byte slice ([]byte, []uint8, types.JSONRaw, etc.)
		bytes := make([]byte, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			bytes[i] = byte(rv.Index(i).Uint())
		}
		// Try to unmarshal as JSON
		var result interface{}
		if err := json.Unmarshal(bytes, &result); err == nil {
			return normalizeValue(result) // Recursively normalize
		}
		// If not valid JSON, return as string
		return string(bytes)
	}

	switch val := v.(type) {
	case map[string]interface{}:
		normalized := make(map[string]interface{})
		for k, v := range val {
			normalized[k] = normalizeValue(v)
		}
		return normalized
	case []interface{}:
		normalized := make([]interface{}, len(val))
		for i, v := range val {
			normalized[i] = normalizeValue(v)
		}
		return normalized
	default:
		return v
	}
}

// buildSectionContent recursively builds hierarchical content from flat page_section_entries.
// It groups entries by their field, handles repeaters (arrays of items with children),
// groups (nested objects), and simple fields.
func buildSectionContent(
	entries []*core.Record,
	fieldById map[string]*core.Record,
	fieldsByParent map[string][]*core.Record,
	entriesByParent map[string][]*core.Record,
) map[string]interface{} {
	content := make(map[string]interface{})

	// Group entries by field ID to handle repeaters (multiple entries for same field)
	entriesByField := make(map[string][]*core.Record)
	for _, entry := range entries {
		fieldId := entry.GetString("field")
		entriesByField[fieldId] = append(entriesByField[fieldId], entry)
	}

	// Collect unique fields and sort by index for consistent YAML output order
	fieldsInContent := make([]*core.Record, 0, len(entriesByField))
	for fieldId := range entriesByField {
		if field, ok := fieldById[fieldId]; ok {
			fieldsInContent = append(fieldsInContent, field)
		}
	}
	sort.Slice(fieldsInContent, func(i, j int) bool {
		return fieldsInContent[i].GetInt("index") < fieldsInContent[j].GetInt("index")
	})

	// Process each field in index order
	for _, field := range fieldsInContent {
		fieldEntries := entriesByField[field.Id]

		fieldKey := field.GetString("key")
		if fieldKey == "" {
			fieldKey = field.GetString("name")
		}
		if fieldKey == "" {
			continue
		}

		fieldType := field.GetString("type")

		switch fieldType {
		case "repeater":
			// Repeater: each entry represents an item, children are nested under each entry
			items := make([]interface{}, 0, len(fieldEntries))
			for _, entry := range fieldEntries {
				// Get children of this entry (not field)
				childEntries := entriesByParent[entry.Id]
				if len(childEntries) > 0 {
					// Recursively build child content
					item := buildSectionContent(childEntries, fieldById, fieldsByParent, entriesByParent)
					items = append(items, item)
				}
			}
			if len(items) > 0 {
				content[fieldKey] = items
			}

		case "group":
			// Group: single entry with nested children
			if len(fieldEntries) > 0 {
				entry := fieldEntries[0]
				// First try to use stored value if it's a complete object
				storedValue := normalizeValue(entry.Get("value"))
				if storedMap, ok := storedValue.(map[string]interface{}); ok && len(storedMap) > 0 {
					content[fieldKey] = storedMap
				} else {
					// Build from child entries
					childEntries := entriesByParent[entry.Id]
					if len(childEntries) > 0 {
						content[fieldKey] = buildSectionContent(childEntries, fieldById, fieldsByParent, entriesByParent)
					}
				}
			}

		default:
			// Simple field: text, link, image, select, etc.
			if len(fieldEntries) == 1 {
				content[fieldKey] = normalizeValue(fieldEntries[0].Get("value"))
			} else if len(fieldEntries) > 1 {
				// Multiple entries for same simple field (list type)
				values := make([]interface{}, 0, len(fieldEntries))
				for _, entry := range fieldEntries {
					values = append(values, normalizeValue(entry.Get("value")))
				}
				content[fieldKey] = values
			}
		}
	}

	return content
}
