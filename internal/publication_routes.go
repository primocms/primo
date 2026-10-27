package internal

import (
	"fmt"
	"path"

	"github.com/pocketbase/pocketbase/core"
)

// validatePublicationPages requires one homepage and one public path per page.
// It rejects invalid drafts before generation so detached roots cannot overwrite
// index.html and disconnected sections of the tree cannot silently disappear.
func validatePublicationPages(pages []*core.Record) error {
	if len(pages) == 0 {
		return nil
	}
	children := make(map[string][]*core.Record)
	for _, page := range pages {
		children[page.GetString("parent")] = append(children[page.GetString("parent")], page)
	}
	roots := children[""]
	if len(roots) != 1 {
		return fmt.Errorf("cannot publish: expected one homepage, found %d; repair page parents before publishing", len(roots))
	}
	visited := make(map[string]bool)
	routes := make(map[string]string)
	var visit func(*core.Record, string) error
	visit = func(page *core.Record, route string) error {
		if visited[page.Id] {
			return fmt.Errorf("cannot publish: cycle at page %q", page.GetString("name"))
		}
		visited[page.Id] = true
		key := path.Clean("/" + route)
		if previous, exists := routes[key]; exists {
			return fmt.Errorf("cannot publish: pages %s and %s share route %q", previous, page.Id, key)
		}
		routes[key] = page.Id
		for _, child := range children[page.Id] {
			if err := visit(child, route+"/"+child.GetString("slug")); err != nil {
				return err
			}
		}
		return nil
	}
	if err := visit(roots[0], ""); err != nil {
		return err
	}
	if len(visited) != len(pages) {
		return fmt.Errorf("cannot publish: %d pages are disconnected from the homepage; repair page parents before publishing", len(pages)-len(visited))
	}
	return nil
}
