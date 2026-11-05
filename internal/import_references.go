package internal

import (
	"fmt"
	"sort"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

// validateImportPageReferences checks page dependencies before importing fields,
// uploads, or content. A partial archive may reference existing records, but an
// unresolved dependency must reject preview and apply rather than drop a section.
func validateImportPageReferences(app core.App, site *core.Record, files map[string][]byte) error {
	symbols, err := app.FindRecordsByFilter("site_symbols", "site = {:site}", "", 0, 0, dbx.Params{"site": site.Id})
	if err != nil {
		return err
	}
	blocks := importSymbolLookup(symbols, nil)
	for _, folder := range findDirectories(files, "blocks/") {
		prefix := "blocks/" + folder + "/"
		if files[prefix+"config.yaml"] == nil && files[prefix+"component.svelte"] == nil && files[prefix+"fields.yaml"] == nil {
			continue
		}
		var config ExportedBlockConfig
		if data := files[prefix+"config.yaml"]; data != nil {
			if err := yaml.Unmarshal(data, &config); err != nil {
				return fmt.Errorf("%sconfig.yaml: %w", prefix, err)
			}
		}
		name := config.Name
		if name == "" {
			name = folder
		}
		for _, key := range []string{folder, strings.ToLower(folder), name, strings.ToLower(name), sanitizeFilename(name)} {
			blocks[key] = folder
		}
	}
	paths, err := buildPagePathMap(app, site.Id)
	if err != nil {
		return err
	}
	type pageReference struct {
		file, path string
		page       ExportedPage
	}
	var incoming []pageReference
	var filenames []string
	for file := range files {
		filenames = append(filenames, file)
	}
	sort.Strings(filenames)
	for _, file := range filenames {
		if !strings.HasPrefix(file, "pages/") {
			continue
		}
		var suffix string
		for _, ext := range []string{".yaml", ".yml", ".json"} {
			if strings.HasSuffix(file, ext) {
				suffix = ext
				break
			}
		}
		if suffix == "" {
			continue
		}
		route := strings.TrimSuffix(strings.TrimPrefix(file, "pages/"), suffix)
		if route == "index" {
			route = ""
		} else {
			route = strings.TrimSuffix(route, "/index")
		}
		var page ExportedPage
		if err := yaml.Unmarshal(files[file], &page); err != nil {
			return fmt.Errorf("%s: %w", file, err)
		}
		incoming = append(incoming, pageReference{file, route, page})
	}
	moves := map[string]string{}
	for _, item := range incoming {
		if item.page.ID != "" {
			moves[item.page.ID] = item.path
		} else {
			var existing *core.Record
			if item.page.Slug != "" {
				existing, _ = app.FindFirstRecordByFilter("pages", "site = {:site} && slug = {:slug}", dbx.Params{"site": site.Id, "slug": item.page.Slug})
			}
			if existing == nil {
				existing, _ = app.FindFirstRecordByFilter("pages", "site = {:site} && name = {:name}", dbx.Params{"site": site.Id, "name": item.page.Name})
			}
			if existing != nil {
				moves[existing.Id] = item.path
			}
		}
	}
	paths = remapImportedPagePaths(paths, moves)
	for _, item := range incoming {
		paths[item.path] = "incoming"
	}
	for _, item := range incoming {
		if item.path != "" {
			parent := ""
			if slash := strings.LastIndex(item.path, "/"); slash >= 0 {
				parent = item.path[:slash]
			}
			if _, ok := paths[parent]; !ok {
				dependency := "pages/index.yaml"
				if parent != "" {
					dependency = "pages/" + parent + ".yaml or pages/" + parent + "/index.yaml"
				}
				return fmt.Errorf("%s: parent page %q is missing; include %s or create it on this site before uploading", item.file, parent, dependency)
			}
		}
		for index, section := range item.page.Sections {
			block := getString(section, "block")
			if blocks[block] == "" && blocks[strings.ToLower(block)] == "" {
				return fmt.Errorf("%s: sections[%d].block references unknown block %q; include blocks/%s/ or correct the reference; no sections were removed", item.file, index, block, block)
			}
		}
	}
	return nil
}

// Omitted descendants retain their IDs and move with their closest imported
// ancestor. Compute from the original map so nested moves don't depend on order.
func remapImportedPagePaths(paths map[string]string, destinations map[string]string) map[string]string {
	moves := map[string]string{}
	for old, id := range paths {
		if next, ok := destinations[id]; ok && old != next && old != "" {
			moves[old] = next
		}
	}
	result := make(map[string]string, len(paths))
	for route, id := range paths {
		next, explicit := destinations[id]
		if !explicit {
			next = route
			closest := ""
			for old, destination := range moves {
				if strings.HasPrefix(route, old+"/") && len(old) > len(closest) {
					closest = old
					next = strings.TrimPrefix(destination+strings.TrimPrefix(route, old), "/")
				}
			}
		}
		result[next] = id
	}
	return result
}

// importSymbolLookup indexes stable folder keys and editable display names.
// It resolves aliases first and folders last so a display-name collision cannot
// steal a folder key.
func importSymbolLookup(symbols []*core.Record, folderToDisplayName map[string]string) map[string]string {
	result := make(map[string]string)
	for _, s := range symbols {
		name := s.GetString("name")
		for _, key := range []string{name, strings.ToLower(name), sanitizeFilename(name)} {
			result[key] = s.Id
		}
	}
	for folder, name := range folderToDisplayName {
		if id := result[name]; id != "" {
			result[folder] = id
			result[strings.ToLower(folder)] = id
		}
	}
	for _, s := range symbols {
		if folder := s.GetString("folder"); folder != "" {
			result[folder] = s.Id
			result[strings.ToLower(folder)] = s.Id
		}
	}
	return result
}
