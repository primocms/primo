package internal

import (
	"fmt"
	"sort"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

// Validate page dependencies before importing fields, uploads, or content. A
// partial archive may reference existing records, but an unresolved dependency
// must reject both preview and apply rather than silently dropping a section.
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
	// A moved page cannot still satisfy a dependency at its former URL. Remove
	// that subtree before adding destinations, including parents in this archive.
	for _, item := range incoming {
		if item.page.ID == "" {
			continue
		}
		for old, id := range paths {
			if id == item.page.ID && old != item.path {
				for route := range paths {
					if route == old || (old != "" && strings.HasPrefix(route, old+"/")) {
						delete(paths, route)
					}
				}
			}
		}
	}
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

// Folder names are stable keys, unlike editable display names. Resolve aliases
// first and folders last so a display-name collision cannot steal a folder key.
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
