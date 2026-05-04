package internal

import (
	"archive/zip"
	"bytes"
	"fmt"
	"sort"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type ExportedLibraryGroup struct {
	ID     string `json:"id" yaml:"id"`
	Name   string `json:"name" yaml:"name"`
	Folder string `json:"folder" yaml:"folder"`
	Index  int    `json:"index" yaml:"index"`
}

func RegisterLibraryExportEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.GET("/api/palacms/export-library", func(e *core.RequestEvent) error {
			isLocal := IsLocalhost(e)
			if e.Auth == nil && !isLocal {
				return e.UnauthorizedError("Authentication required", nil)
			}

			zipData, err := exportLibraryToZip(pb)
			if err != nil {
				return e.InternalServerError("Library export failed: "+err.Error(), err)
			}

			e.Response.Header().Set("Content-Type", "application/zip")
			e.Response.Header().Set("Content-Disposition", "attachment; filename=\"library.zip\"")
			e.Response.Write(zipData)
			return nil
		})
		return serveEvent.Next()
	})
	return nil
}

func exportLibraryToZip(pb *pocketbase.PocketBase) ([]byte, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	groups, err := pb.FindAllRecords("library_symbol_groups")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch library groups: %w", err)
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].GetInt("index") == groups[j].GetInt("index") {
			return strings.ToLower(groups[i].GetString("name")) < strings.ToLower(groups[j].GetString("name"))
		}
		return groups[i].GetInt("index") < groups[j].GetInt("index")
	})

	groupFolders := make(map[string]string, len(groups))
	usedGroupFolders := make(map[string]bool, len(groups))
	exportedGroups := make([]ExportedLibraryGroup, 0, len(groups))

	for _, group := range groups {
		folder := uniqueSanitizedName(group.GetString("name"), group.Id, usedGroupFolders)
		groupFolders[group.Id] = folder
		exportedGroups = append(exportedGroups, ExportedLibraryGroup{
			ID:     group.Id,
			Name:   group.GetString("name"),
			Folder: folder,
			Index:  group.GetInt("index"),
		})
	}

	if len(exportedGroups) > 0 {
		if err := writeYAMLToZip(zw, "library/groups.yaml", exportedGroups); err != nil {
			return nil, err
		}
	}

	symbols, err := pb.FindAllRecords("library_symbols")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch library symbols: %w", err)
	}

	symbolsByGroup := make(map[string][]*core.Record)
	for _, symbol := range symbols {
		groupID := symbol.GetString("group")
		symbolsByGroup[groupID] = append(symbolsByGroup[groupID], symbol)
	}

	for _, group := range groups {
		groupID := group.Id
		groupFolder := groupFolders[groupID]
		groupSymbols := symbolsByGroup[groupID]
		sort.Slice(groupSymbols, func(i, j int) bool {
			return strings.ToLower(groupSymbols[i].GetString("name")) < strings.ToLower(groupSymbols[j].GetString("name"))
		})

		usedBlockFolders := make(map[string]bool, len(groupSymbols))
		for _, symbol := range groupSymbols {
			blockFolder := uniqueSanitizedName(symbol.GetString("name"), symbol.Id, usedBlockFolders)
			basePath := fmt.Sprintf("library/%s/%s", groupFolder, blockFolder)

			raw := symbol.GetString("raw_source")
			var output []byte
			if raw != "" {
				output = []byte(raw)
			} else {
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
					output = []byte(code.String())
				}
			}

			if len(output) > 0 {
				if err := writeFileToZip(zw, basePath+"/component.svelte", output); err != nil {
					return nil, err
				}
			}

			fields, err := pb.FindRecordsByFilter("library_symbol_fields", "symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})
			if err != nil {
				return nil, fmt.Errorf("failed to fetch library symbol fields: %w", err)
			}

			symbolFieldIdToKey := make(map[string]string, len(fields))
			for _, field := range fields {
				key := field.GetString("key")
				if key == "" {
					key = field.GetString("name")
				}
				symbolFieldIdToKey[field.Id] = key
			}

			exportedFields := make([]map[string]interface{}, 0, len(fields))
			for _, field := range fields {
				exportedFields = append(exportedFields, fieldRecordToMap(field, symbolFieldIdToKey, nil, nil))
			}

			blockConfig := ExportedBlockConfig{
				ID:   symbol.Id,
				Name: symbol.GetString("name"),
			}
			if err := writeYAMLToZip(zw, basePath+"/config.yaml", blockConfig); err != nil {
				return nil, err
			}

			blockFields := ExportedBlockFields(orderedFields(nestSubfields(exportedFields)))
			if err := writeYAMLToZip(zw, basePath+"/fields.yaml", blockFields); err != nil {
				return nil, err
			}

			fieldByID := make(map[string]*core.Record, len(fields))
			fieldsByParent := make(map[string][]*core.Record)
			for _, field := range fields {
				fieldByID[field.Id] = field
				parentID := field.GetString("parent")
				if parentID != "" {
					fieldsByParent[parentID] = append(fieldsByParent[parentID], field)
				}
			}

			allEntries, err := pb.FindRecordsByFilter("library_symbol_entries", "field.symbol = {:symbol}", "+index", 0, 0, dbx.Params{"symbol": symbol.Id})
			if err != nil {
				return nil, fmt.Errorf("failed to fetch library symbol entries: %w", err)
			}

			entriesByParent := make(map[string][]*core.Record)
			for _, entry := range allEntries {
				parentID := entry.GetString("parent")
				entriesByParent[parentID] = append(entriesByParent[parentID], entry)
			}
			for parentID := range entriesByParent {
				entries := entriesByParent[parentID]
				sort.Slice(entries, func(i, j int) bool {
					return entries[i].GetInt("index") < entries[j].GetInt("index")
				})
			}

			// content.yaml is required for blocks; emit even when no defaults
			// so importers/validators can rely on its presence.
			symbolContent := buildSectionContent(entriesByParent[""], fieldByID, fieldsByParent, entriesByParent)
			if err := writeYAMLToZip(zw, basePath+"/content.yaml", symbolContent); err != nil {
				return nil, err
			}
		}
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func uniqueSanitizedName(name, fallback string, used map[string]bool) string {
	candidate := sanitizeFilename(name)
	if candidate == "" {
		candidate = sanitizeFilename(fallback)
	}
	if candidate == "" {
		candidate = "item"
	}
	if !used[candidate] {
		used[candidate] = true
		return candidate
	}

	withFallback := candidate
	if fallback != "" {
		withFallback = sanitizeFilename(name + "-" + fallback)
		if withFallback != "" && !used[withFallback] {
			used[withFallback] = true
			return withFallback
		}
	}

	for i := 2; ; i++ {
		next := fmt.Sprintf("%s-%d", candidate, i)
		if !used[next] {
			used[next] = true
			return next
		}
	}
}
