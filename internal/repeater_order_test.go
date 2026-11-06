package internal

import (
	"errors"
	"reflect"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
)

func repeaterFixture(t *testing.T, count int) (*pocketbase.PocketBase, *core.RequestInfo, repeaterOrderRequest, []*core.Record) {
	t.Helper()
	app := newImportTestApp(t)
	t.Cleanup(func() { app.ResetBootstrapState() })
	site := createImportTestSite(t, app)
	fields, _ := app.FindCollectionByNameOrId("site_fields")
	field := core.NewRecord(fields)
	field.Set("site", site.Id)
	field.Set("key", "items")
	field.Set("label", "Items")
	field.Set("type", "repeater")
	if err := app.Save(field); err != nil {
		t.Fatal(err)
	}
	entries, _ := app.FindCollectionByNameOrId("site_entries")
	request := repeaterOrderRequest{Collection: "site_entries", Owner: site.Id, Field: field.Id, Locale: "en", Expected: map[string]int{}}
	items := make([]*core.Record, count)
	for i := range count {
		item := core.NewRecord(entries)
		item.Set("field", field.Id)
		item.Set("index", i*3)
		item.Set("locale", "en")
		if err := app.Save(item); err != nil {
			t.Fatal(err)
		}
		items[i] = item
		request.IDs = append([]string{item.Id}, request.IDs...)
		request.Expected[item.Id] = i * 3
	}
	superusers, _ := app.FindCollectionByNameOrId("_superusers")
	info := &core.RequestInfo{Auth: core.NewRecord(superusers)}
	return app, info, request, items
}

func requireOrderStatus(t *testing.T, err error, status int) {
	t.Helper()
	var apiErr *router.ApiError
	if !errors.As(err, &apiErr) || apiErr.Status != status {
		t.Fatalf("got %v, want status %d", err, status)
	}
}

func TestRepeaterOrderNormalizesLargeListAndPreservesChildren(t *testing.T) {
	app, info, request, items := repeaterFixture(t, 25)
	fields, _ := app.FindCollectionByNameOrId("site_fields")
	childField := core.NewRecord(fields)
	childField.Set("site", request.Owner)
	childField.Set("parent", request.Field)
	childField.Set("type", "text")
	childField.Set("key", "name")
	childField.Set("label", "Name")
	if err := app.Save(childField); err != nil {
		t.Fatal(err)
	}
	entries, _ := app.FindCollectionByNameOrId("site_entries")
	child := core.NewRecord(entries)
	child.Set("field", childField.Id)
	child.Set("parent", items[0].Id)
	child.Set("locale", "en")
	child.Set("value", "Alpha")
	if err := app.Save(child); err != nil {
		t.Fatal(err)
	}
	result, err := saveRepeaterOrder(app, info, request)
	if err != nil {
		t.Fatal(err)
	}
	for index, record := range result {
		if record.Id != request.IDs[index] || record.GetInt("index") != index {
			t.Fatalf("wrong item at %d", index)
		}
	}
	persisted, _ := app.FindRecordById("site_entries", child.Id)
	if persisted.GetString("parent") != items[0].Id || normalizeValue(persisted.Get("value")) != "Alpha" {
		t.Fatal("child identity/value changed")
	}
	// Lost-response retry: the original expected indices are now stale, but
	// exactly this desired order is already present and is safe to accept.
	if _, err := saveRepeaterOrder(app, info, request); err != nil {
		t.Fatalf("retry: %v", err)
	}
}

func TestRepeaterOrderRejectsDuplicateForeignAndStaleOrders(t *testing.T) {
	app, info, request, items := repeaterFixture(t, 3)
	duplicate := request
	duplicate.IDs = []string{items[0].Id, items[0].Id, items[2].Id}
	_, err := saveRepeaterOrder(app, info, duplicate)
	requireOrderStatus(t, err, 400)
	foreign := request
	foreign.IDs = []string{items[0].Id, items[1].Id, "doesnotexist000"}
	_, err = saveRepeaterOrder(app, info, foreign)
	requireOrderStatus(t, err, 400)
	items[0].Set("index", 99)
	if err := app.Save(items[0]); err != nil {
		t.Fatal(err)
	}
	_, err = saveRepeaterOrder(app, info, request)
	requireOrderStatus(t, err, 409)
	if err := app.Delete(items[1]); err != nil {
		t.Fatal(err)
	}
	_, err = saveRepeaterOrder(app, info, request)
	requireOrderStatus(t, err, 409)
	wrongOwner := request
	wrongOwner.Owner = "doesnotexist000"
	_, err = saveRepeaterOrder(app, info, wrongOwner)
	requireOrderStatus(t, err, 400)
}

func TestRepeaterOrderRollsBackEveryIndexOnFailure(t *testing.T) {
	app, info, request, items := repeaterFixture(t, 3)
	app.OnRecordUpdate("site_entries").BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Id == items[1].Id {
			return errors.New("injected save failure")
		}
		return e.Next()
	})
	if _, err := saveRepeaterOrder(app, info, request); err == nil {
		t.Fatal("expected failure")
	}
	for _, item := range items {
		persisted, _ := app.FindRecordById("site_entries", item.Id)
		if persisted.GetInt("index") != request.Expected[item.Id] {
			t.Fatal("partial order persisted")
		}
	}
}

func TestRepeaterOrderChecksUpdatePermissions(t *testing.T) {
	app, _, request, _ := repeaterFixture(t, 3)
	_, err := saveRepeaterOrder(app, &core.RequestInfo{}, request)
	requireOrderStatus(t, err, 401)
	users, _ := app.FindCollectionByNameOrId("users")
	_, err = saveRepeaterOrder(app, &core.RequestInfo{Auth: core.NewRecord(users)}, request)
	requireOrderStatus(t, err, 403)
}

func TestRepeaterOrderIsolatesNestedParentsAndLocales(t *testing.T) {
	app, info, rootRequest, parents := repeaterFixture(t, 2)
	fields, _ := app.FindCollectionByNameOrId("site_fields")
	nested := core.NewRecord(fields)
	nested.Set("site", rootRequest.Owner)
	nested.Set("parent", rootRequest.Field)
	nested.Set("type", "repeater")
	nested.Set("key", "nested")
	nested.Set("label", "Nested")
	if err := app.Save(nested); err != nil {
		t.Fatal(err)
	}
	entries, _ := app.FindCollectionByNameOrId("site_entries")
	request := repeaterOrderRequest{Collection: "site_entries", Owner: rootRequest.Owner, Field: nested.Id, Parent: parents[0].Id, Locale: "en", Expected: map[string]int{}}
	var others []*core.Record
	for _, parent := range parents {
		for _, locale := range []string{"en", "es"} {
			for index := range 2 {
				item := core.NewRecord(entries)
				item.Set("field", nested.Id)
				item.Set("parent", parent.Id)
				item.Set("locale", locale)
				item.Set("index", index*3)
				if err := app.Save(item); err != nil {
					t.Fatal(err)
				}
				if parent.Id == parents[0].Id && locale == "en" {
					request.IDs = append([]string{item.Id}, request.IDs...)
					request.Expected[item.Id] = index * 3
				} else {
					others = append(others, item)
				}
			}
		}
	}
	if _, err := saveRepeaterOrder(app, info, request); err != nil {
		t.Fatal(err)
	}
	for _, item := range others {
		persisted, _ := app.FindRecordById("site_entries", item.Id)
		if !reflect.DeepEqual(persisted.GetInt("index"), item.GetInt("index")) {
			t.Fatal("changed another parent/locale")
		}
	}
}

func TestRepeaterOrderSupportsEveryEntryCollection(t *testing.T) {
	for collection, config := range repeaterCollections {
		t.Run(collection, func(t *testing.T) {
			app, info, _, _ := repeaterFixture(t, 0)
			site := createRepeaterRecord(t, app, "sites", map[string]any{"name": "Scopes", "host": "scopes.localhost", "group": mustDefaultGroup(t, app)})
			symbol := createRepeaterRecord(t, app, "site_symbols", map[string]any{"name": "Block", "site": site.Id})
			pageType := createRepeaterRecord(t, app, "page_types", map[string]any{"name": "Default", "site": site.Id})
			page := createRepeaterRecord(t, app, "pages", map[string]any{"name": "Home", "site": site.Id, "page_type": pageType.Id})
			var owner *core.Record
			switch config.owners {
			case "sites":
				owner = site
			case "site_symbols":
				owner = symbol
			case "page_types":
				owner = pageType
			case "pages":
				owner = page
			case "page_sections":
				owner = createRepeaterRecord(t, app, config.owners, map[string]any{"page": page.Id, "symbol": symbol.Id})
			case "page_type_sections":
				owner = createRepeaterRecord(t, app, config.owners, map[string]any{"page_type": pageType.Id, "symbol": symbol.Id, "zone": "body"})
			case "library_symbols":
				group := createRepeaterRecord(t, app, "library_symbol_groups", map[string]any{"name": "Library"})
				owner = createRepeaterRecord(t, app, config.owners, map[string]any{"name": "Library block", "group": group.Id})
			}
			fieldOwner := owner.Id
			if config.entryOwner != "" {
				fieldOwner = owner.GetString(config.fieldOwner)
			}
			field := createRepeaterRecord(t, app, config.fields, map[string]any{config.fieldOwner: fieldOwner, "type": "repeater", "key": "items", "label": "Items"})
			request := repeaterOrderRequest{Collection: collection, Owner: owner.Id, Field: field.Id, Locale: "en", Expected: map[string]int{}}
			for index := range 3 {
				values := map[string]any{"field": field.Id, "locale": "en", "index": index}
				if config.entryOwner != "" {
					values[config.entryOwner] = owner.Id
				}
				item := createRepeaterRecord(t, app, collection, values)
				request.IDs = append([]string{item.Id}, request.IDs...)
				request.Expected[item.Id] = index
			}
			result, err := saveRepeaterOrder(app, info, request)
			if err != nil {
				t.Fatal(err)
			}
			for index, item := range result {
				if item.Id != request.IDs[index] || item.GetInt("index") != index {
					t.Fatal("incorrect order")
				}
			}
			// Deliberately permissive collection rules isolate the additional
			// content/design restriction that REST permission hooks would apply.
			model, _ := app.FindCollectionByNameOrId(collection)
			model.UpdateRule = types.Pointer("@request.auth.id != ''")
			if err := app.Save(model); err != nil {
				t.Fatal(err)
			}
			editor := permissionRecord(t, app, "users", map[string]any{"email": "reorder-editor@example.test", "serverRole": "editor"})
			_, err = saveRepeaterOrder(app, &core.RequestInfo{Auth: editor}, request)
			switch collection {
			case "site_entries", "page_entries", "page_section_entries", "page_type_section_entries":
				if err != nil {
					t.Fatalf("content reorder denied: %v", err)
				}
			default:
				requireOrderStatus(t, err, 403)
			}

		})
	}
}

func createRepeaterRecord(t *testing.T, app core.App, collection string, values map[string]any) *core.Record {
	t.Helper()
	model, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		t.Fatal(err)
	}
	record := core.NewRecord(model)
	for key, value := range values {
		record.Set(key, value)
	}
	if err := app.Save(record); err != nil {
		t.Fatalf("create %s: %v", collection, err)
	}
	return record
}

func mustDefaultGroup(t *testing.T, app core.App) string {
	t.Helper()
	id, err := ensureDefaultGroup(app)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func TestRepeaterOrderExportUsesSavedOrder(t *testing.T) {
	app, info, request, originals := repeaterFixture(t, 3)
	childField := createRepeaterRecord(t, app, "site_fields", map[string]any{"site": request.Owner, "parent": request.Field, "key": "name", "label": "Name", "type": "text"})
	children := map[string][]*core.Record{}
	for index, original := range originals {
		child := createRepeaterRecord(t, app, "site_entries", map[string]any{"field": childField.Id, "parent": original.Id, "index": 0, "locale": "en", "value": index})
		children[original.Id] = []*core.Record{child}
	}
	if _, err := saveRepeaterOrder(app, info, request); err != nil {
		t.Fatal(err)
	}
	field, _ := app.FindRecordById("site_fields", request.Field)
	// Feed the exporter original/insertion order, deliberately different from
	// the persisted indices, as some callers do.
	var entries []*core.Record
	for _, original := range originals {
		item, _ := app.FindRecordById("site_entries", original.Id)
		entries = append(entries, item)
	}
	content := buildSectionContent(entries, map[string]*core.Record{field.Id: field, childField.Id: childField}, map[string][]*core.Record{field.Id: {childField}}, children)
	items := content.values["items"].([]interface{})
	for index, item := range items {
		if item.(*orderedMap).values["name"] != float64(2-index) {
			t.Fatalf("export item %d: %#v", index, item)
		}
	}
}

func TestRepeaterOrderChecksPermissionsAgainstProposedIndex(t *testing.T) {
	app, _, request, _ := repeaterFixture(t, 3)
	collection, _ := app.FindCollectionByNameOrId(request.Collection)
	collection.UpdateRule = types.Pointer("@request.body.index = index")
	if err := app.Save(collection); err != nil {
		t.Fatal(err)
	}
	users, _ := app.FindCollectionByNameOrId("users")
	_, err := saveRepeaterOrder(app, &core.RequestInfo{Auth: core.NewRecord(users)}, request)
	requireOrderStatus(t, err, 403)
}
