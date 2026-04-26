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
	Name       string `json:"name" yaml:"name"`
	Host       string `json:"host" yaml:"host"`
	SiteID     string `json:"site_id" yaml:"site_id"`
	Group      string `json:"group,omitempty" yaml:"group,omitempty"`
	ExportedAt string `json:"exported_at" yaml:"exported_at"`
	Version    string `json:"version" yaml:"version"`
}

// ExportedBlock represents a block's fields.yaml.
// Fields is []interface{} (not []map[string]interface{}) so the export side
// can emit each field as an *orderedMap with canonical key order. On import,
// each entry is asserted to map[string]interface{}.
type ExportedBlock struct {
	ID     string        `json:"_id" yaml:"_id"`
	Name   string        `json:"name" yaml:"name"`
	Fields []interface{} `json:"fields" yaml:"fields"`
}

// ExportedPageType represents a page type's config.
// See ExportedBlock for the rationale on Fields being []interface{}.
type ExportedPageType struct {
	ID            string        `json:"id" yaml:"id"`
	Name          string        `json:"name" yaml:"name"`
	Icon          string        `json:"icon,omitempty" yaml:"icon,omitempty"`
	Color         string        `json:"color,omitempty" yaml:"color,omitempty"`
	AllowedBlocks []string      `json:"allowed_blocks,omitempty" yaml:"allowed_blocks,omitempty"`
	Fields        []interface{} `json:"fields,omitempty" yaml:"fields,omitempty"`
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

// ExportedSiteConfig represents site-wide configuration.
// See ExportedBlock for the rationale on Fields being []interface{}.
type ExportedSiteConfig struct {
	Fields  []interface{}          `json:"fields,omitempty"`
	Content map[string]interface{} `json:"content,omitempty"`
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
			Fields: orderedFields(nestSubfields(exportedFields)),
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
		if len(symbolContent.values) > 0 {
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
			Fields:        orderedFields(nestSubfields(exportedPTFields)),
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
				if len(content.values) > 0 {
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
		if err := writeYAMLToZip(zw, "site/fields.yaml", orderedFields(nestSubfields(exportedSiteFields))); err != nil {
			return nil, err
		}
	}

	// Site entries (content values) - use same approach as buildSectionContent
	var siteContent *orderedMap
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

	if siteContent != nil && len(siteContent.values) > 0 {
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

	// 6. Generate AGENTS.md
	readme := generateReadme(site, symbols, pageTypes, symbolNames, pageTypeNames)
	if err := writeFileToZip(zw, "AGENTS.md", []byte(readme)); err != nil {
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
	sb.WriteString("Primo site export. The Primo MCP server (`primo`) is the source of truth, when present, for schema, validation, field types, and inline editing. Call `list_docs` first to see what's documented.\n")
	sb.WriteString("Without the MCP server, read `blocks/*/fields.yaml` and `page-types/*/config.yaml` to infer schemas, and treat `pages/*.yaml` section `content:` as the source of truth for rendered content (block `content.yaml` files are defaults only).\n\n")

	sb.WriteString("## Layout\n")
	sb.WriteString("- `site.yaml`, `site/`, `blocks/`, `page-types/`, `pages/`, `.primo/`\n")
	sb.WriteString("- Blocks live in `blocks/`; pages live in `pages/`; page types live in `page-types/`.\n\n")

	sb.WriteString("## This site\n")
	sb.WriteString("### Blocks\n")
	if len(symbols) == 0 {
		sb.WriteString("- (none)\n")
	}
	for _, symbol := range symbols {
		name := symbolNames[symbol.Id]
		sb.WriteString(fmt.Sprintf("- `%s` - %s\n", name, symbol.GetString("name")))
	}
	sb.WriteString("\n")

	sb.WriteString("### Page types\n")
	if len(pageTypes) == 0 {
		sb.WriteString("- (none)\n")
	}
	for _, pt := range pageTypes {
		name := pageTypeNames[pt.Id]
		sb.WriteString(fmt.Sprintf("- `%s` - %s\n", name, pt.GetString("name")))
	}
	sb.WriteString("\n")

	sb.WriteString("## Workflow\n")
	sb.WriteString("- When building out a new site, call `get_docs('recommended-defaults')` first for baseline fields and the wiring checklist.\n")
	sb.WriteString("- After editing a block file, call `validate_block`.\n")
	sb.WriteString("- After editing a page or page-type file, call `validate_page`.\n")
	sb.WriteString("- When creating a new block or page type, prefer `scaffold_block` / `scaffold_page_type`.\n")
	sb.WriteString("- When you create a reusable block, add its folder name to the relevant page type's `allowed_blocks` — otherwise it won't appear in the editor sidebar.\n")
	sb.WriteString("- For everything else, call `get_docs` with the relevant section.\n")
	sb.WriteString("- Block components are Svelte 5. If the Svelte MCP server is available, use `mcp__svelte__svelte-autofixer` after editing `.svelte` files.\n\n")

	sb.WriteString("## Permission prompts\n")
	sb.WriteString("Your MCP client may prompt before each Primo tool call. All Primo MCP tools are read-only or return scaffolds — they don't modify your files. To skip the prompts, allowlist the `primo` server in your client's MCP settings (mechanism varies by client).\n")

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
//
// Returns a *orderedMap so the YAML emit preserves field-declaration order
// instead of alphabetizing keys (which is yaml.v3's default for plain maps).
// Without this, every CMS->files round-trip would reorder content keys.
func buildSectionContent(
	entries []*core.Record,
	fieldById map[string]*core.Record,
	fieldsByParent map[string][]*core.Record,
	entriesByParent map[string][]*core.Record,
) *orderedMap {
	values := make(map[string]interface{})
	keys := make([]string, 0)

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

	addKV := func(k string, v interface{}) {
		if _, exists := values[k]; !exists {
			keys = append(keys, k)
		}
		values[k] = v
	}

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
				addKV(fieldKey, items)
			}

		case "group":
			// Group: single entry with nested children
			if len(fieldEntries) > 0 {
				entry := fieldEntries[0]
				// First try to use stored value if it's a complete object
				storedValue := normalizeValue(entry.Get("value"))
				if storedMap, ok := storedValue.(map[string]interface{}); ok && len(storedMap) > 0 {
					addKV(fieldKey, storedMap)
				} else {
					// Build from child entries
					childEntries := entriesByParent[entry.Id]
					if len(childEntries) > 0 {
						addKV(fieldKey, buildSectionContent(childEntries, fieldById, fieldsByParent, entriesByParent))
					}
				}
			}

		default:
			// Simple field: text, link, image, select, etc.
			if len(fieldEntries) == 1 {
				addKV(fieldKey, normalizeValue(fieldEntries[0].Get("value")))
			} else if len(fieldEntries) > 1 {
				// Multiple entries for same simple field (list type)
				vals := make([]interface{}, 0, len(fieldEntries))
				for _, entry := range fieldEntries {
					vals = append(vals, normalizeValue(entry.Get("value")))
				}
				addKV(fieldKey, vals)
			}
		}
	}

	return &orderedMap{keys: keys, values: values}
}
