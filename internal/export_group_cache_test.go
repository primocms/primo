package internal

import (
	"reflect"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"gopkg.in/yaml.v3"
)

func TestExportNestedOrderAndChildValuesOverrideGroupImportCache(t *testing.T) {
	app, info, root, items := repeaterFixture(t, 1)
	field := func(key, kind, parent string) *core.Record {
		return createRepeaterRecord(t, app, "site_fields", map[string]any{"site": root.Owner, "parent": parent, "key": key, "label": key, "type": kind})
	}
	groupField := field("details", "group", root.Field)
	linksField := field("links", "repeater", groupField.Id)
	labelField := field("label", "text", linksField.Id)
	removedField := field("removed", "text", groupField.Id)
	entry := func(field, parent string, index int, value any) *core.Record {
		return createRepeaterRecord(t, app, "site_entries", map[string]any{"field": field, "parent": parent, "index": index, "locale": "en", "value": value})
	}
	group := entry(groupField.Id, items[0].Id, 0, map[string]any{"links": []any{map[string]any{"label": "First"}, map[string]any{"label": "Second"}}, "legacy_extra": "Keep me", "removed": "Do not resurrect"})
	first := entry(linksField.Id, group.Id, 0, nil)
	second := entry(linksField.Id, group.Id, 1, nil)
	entry(labelField.Id, first.Id, 0, "First edited")
	entry(labelField.Id, second.Id, 0, "Second")
	if _, err := saveRepeaterOrder(app, info, repeaterOrderRequest{Collection: root.Collection, Owner: root.Owner, Field: linksField.Id, Parent: group.Id, Locale: "en", IDs: []string{second.Id, first.Id}, Expected: map[string]int{first.Id: 0, second.Id: 1}}); err != nil {
		t.Fatal(err)
	}
	rootField, _ := app.FindRecordById("site_fields", root.Field)
	definitions := map[string]*core.Record{rootField.Id: rootField, groupField.Id: groupField, linksField.Id: linksField, labelField.Id: labelField, removedField.Id: removedField}
	stored, err := app.FindAllRecords("site_entries")
	if err != nil {
		t.Fatal(err)
	}
	children := map[string][]*core.Record{}
	for _, item := range stored {
		children[item.GetString("parent")] = append(children[item.GetString("parent")], item)
	}
	content := buildSectionContent(children[""], definitions, nil, children)
	serialized, err := yaml.Marshal(content)
	if err != nil {
		t.Fatal(err)
	}
	var exported map[string]any
	if err := yaml.Unmarshal(serialized, &exported); err != nil {
		t.Fatal(err)
	}
	details := exported["items"].([]any)[0].(map[string]any)["details"].(map[string]any)
	links := details["links"].([]any)
	got := []any{links[0].(map[string]any)["label"], links[1].(map[string]any)["label"]}
	if !reflect.DeepEqual(got, []any{"Second", "First edited"}) {
		t.Fatalf("stale cached group masked authoritative children: %v", got)
	}
	if details["legacy_extra"] != "Keep me" {
		t.Fatal("unmodeled legacy value was lost")
	}
	if _, exists := details["removed"]; exists {
		t.Fatal("deleted modeled child was resurrected")
	}
	unchanged, _ := app.FindRecordById("site_entries", group.Id)
	if normalizeValue(unchanged.Get("value")).(map[string]interface{})["removed"] != "Do not resurrect" {
		t.Fatal("export mutated stored content")
	}
}

func TestExportStoredOnlyLegacyGroupStillSurvives(t *testing.T) {
	app, _, request, _ := repeaterFixture(t, 0)
	field := createRepeaterRecord(t, app, "site_fields", map[string]any{"site": request.Owner, "key": "legacy", "label": "Legacy", "type": "group"})
	entry := createRepeaterRecord(t, app, "site_entries", map[string]any{"field": field.Id, "locale": "en", "value": map[string]any{"retained": "Stored-only value"}})
	content := buildSectionContent([]*core.Record{entry}, map[string]*core.Record{field.Id: field}, nil, nil)
	if content.values["legacy"].(map[string]interface{})["retained"] != "Stored-only value" {
		t.Fatal("legacy group lost")
	}
}
