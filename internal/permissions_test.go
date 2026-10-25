package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func permissionRecord(t *testing.T, app core.App, collection string, values map[string]any) *core.Record {
	t.Helper()
	coll, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		t.Fatal(err)
	}
	record := core.NewRecord(coll)
	for key, value := range values {
		record.Set(key, value)
	}
	if collection == "users" {
		record.SetPassword("permission-test-password")
	}
	if err := app.Save(record); err != nil {
		t.Fatal(err)
	}
	return record
}

func permissionToken(t *testing.T, record *core.Record) string {
	t.Helper()
	token, err := record.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestContentEditorPermissions(t *testing.T) {
	app := newPushTestApp(t)
	defer app.ResetBootstrapState()
	if err := RegisterContentPermissions(app); err != nil {
		t.Fatal(err)
	}
	if err := RegisterDomainEndpoints(app); err != nil {
		t.Fatal(err)
	}
	if err := RegisterCloneSiteEndpoint(app); err != nil {
		t.Fatal(err)
	}
	app.Settings().Batch.Enabled = true
	if err := app.Save(app.Settings()); err != nil {
		t.Fatal(err)
	}
	handler, developer := pushTestHTTP(t, app)
	site, entry, archive := pushFixture(t, app)
	section, _ := app.FindRecordById("page_sections", entry.GetString("section"))
	page, _ := app.FindRecordById("pages", section.GetString("page"))
	symbol, _ := app.FindRecordById("site_symbols", section.GetString("symbol"))
	field, _ := app.FindRecordById("site_symbol_fields", entry.GetString("field"))
	pageType, _ := app.FindRecordById("page_types", page.GetString("page_type"))
	user := permissionRecord(t, app, "users", map[string]any{"email": "editor@example.test"})
	assignment := permissionRecord(t, app, "site_role_assignments", map[string]any{"site": site.Id, "user": user.Id, "role": "editor"})
	editor := permissionToken(t, user)
	outsider := permissionRecord(t, app, "users", map[string]any{"email": "outsider@example.test"})
	// A developer on a different site must not grant design access here.
	otherSite := permissionRecord(t, app, "sites", map[string]any{"name": "Other", "host": "other.example.test", "group": site.GetString("group")})
	permissionRecord(t, app, "site_role_assignments", map[string]any{"site": otherSite.Id, "user": user.Id, "role": "developer"})
	request := func(method, route, token string, body any) *httptest.ResponseRecorder {
		t.Helper()
		data, _ := json.Marshal(body)
		req := httptest.NewRequest(method, route, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", token)
		result := httptest.NewRecorder()
		handler.ServeHTTP(result, req)
		return result
	}
	route := func(collection, id string) string {
		s := "/api/collections/" + collection + "/records"
		if id != "" {
			s += "/" + id
		}
		return s
	}
	denied := func(t *testing.T, result *httptest.ResponseRecorder) {
		t.Helper()
		if result.Code < 400 || result.Code >= 500 {
			t.Fatalf("wanted denial: %d %s", result.Code, result.Body)
		}
	}
	for _, test := range []struct {
		name, method, collection, id string
		body                         any
	}{
		{"block code", "PATCH", "site_symbols", symbol.Id, map[string]any{"html": "<h1>Broken</h1>"}},
		{"block delete", "DELETE", "site_symbols", symbol.Id, nil},
		{"new block", "POST", "site_symbols", "", map[string]any{"site": site.Id, "name": "Forbidden", "html": "<p>Injected</p>"}},
		{"field schema", "PATCH", "site_symbol_fields", field.Id, map[string]any{"key": "changed"}},
		{"page type", "PATCH", "page_types", pageType.Id, map[string]any{"name": "Changed"}},
		{"new page type", "POST", "page_types", "", map[string]any{"site": site.Id, "name": "Forbidden"}},
		{"site head", "PATCH", "sites", site.Id, map[string]any{"head": "<script>bad()</script>"}},
		{"site host", "PATCH", "sites", site.Id, map[string]any{"host": "changed.example.test"}},
		{"site delete", "DELETE", "sites", site.Id, nil},
		{"home delete", "DELETE", "pages", page.Id, nil},
		{"section symbol", "PATCH", "page_sections", section.Id, map[string]any{"symbol": "unknown"}},
		{"role escalation", "PATCH", "site_role_assignments", assignment.Id, map[string]any{"role": "developer"}},
		{"record retargeting", "PATCH", "site_symbols", symbol.Id, map[string]any{"site": otherSite.Id}},
		{"header structure", "POST", "page_type_sections", "", map[string]any{"page_type": pageType.Id, "symbol": symbol.Id, "zone": "header", "index": 0}},
	} {
		t.Run(test.name, func(t *testing.T) {
			denied(t, request(test.method, route(test.collection, test.id), editor, test.body))
		})
	}
	stored, _ := app.FindRecordById("site_symbols", symbol.Id)
	if stored.GetString("html") != symbol.GetString("html") {
		t.Fatal("design mutated")
	}
	t.Run("batch and custom routes cannot bypass source permissions", func(t *testing.T) {
		batch := request("POST", "/api/batch", editor, map[string]any{"requests": []any{map[string]any{"method": "PATCH", "url": route("site_symbols", symbol.Id), "body": map[string]any{"html": "Batch overwrite"}}}})
		denied(t, batch)
		if !bytes.Contains(batch.Body.Bytes(), []byte("developer")) {
			t.Fatalf("batch did not reach permission gate: %s", batch.Body)
		}
		denied(t, request("POST", "/api/primo/sites/"+site.Id+"/domain", editor, map[string]any{"host": "changed.example.test"}))
		denied(t, request("POST", "/api/primo/clone-site", editor, map[string]any{"source_site_id": site.Id, "name": "Forbidden clone", "group_id": site.GetString("group")}))
		denied(t, request("POST", "/api/primo/bootstrap", editor, map[string]any{}))
	})

	t.Run("allowed content and developer edits", func(t *testing.T) {
		result := request("PATCH", route("page_section_entries", entry.Id), editor, map[string]any{"value": "Client approved"})
		if result.Code != 200 {
			t.Fatalf("content: %d %s", result.Code, result.Body)
		}
		result = request("PATCH", route("site_symbols", symbol.Id), developer, map[string]any{"css": "h1 {color:blue}"})
		if result.Code != 200 {
			t.Fatalf("developer: %d %s", result.Code, result.Body)
		}
		denied(t, request("PATCH", route("page_section_entries", entry.Id), permissionToken(t, outsider), map[string]any{"value": "Other site"}))
	})
	t.Run("entry parent cycles are rejected without losing content", func(t *testing.T) {
		denied(t, request("PATCH", route("page_section_entries", entry.Id), editor, map[string]any{"parent": entry.Id}))
		child := permissionRecord(t, app, "page_section_entries", map[string]any{"section": section.Id, "field": field.Id, "locale": "en", "index": 1, "parent": entry.Id, "value": "Nested content"})
		denied(t, request("PATCH", route("page_section_entries", entry.Id), editor, map[string]any{"parent": child.Id}))
		stored, err := app.FindRecordById("page_section_entries", entry.Id)
		if err != nil || stored.GetString("parent") != "" {
			t.Fatalf("entry hierarchy changed: %v", err)
		}
		var value string
		if err := stored.UnmarshalJSONField("value", &value); err != nil || value != "Client approved" {
			t.Fatalf("content changed: %q %v", value, err)
		}
		if err := app.Delete(child); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("pages and available body sections", func(t *testing.T) {
		result := request("POST", route("pages", ""), editor, map[string]any{"site": site.Id, "parent": page.Id, "page_type": pageType.Id, "name": "Contact", "slug": "contact"})
		if result.Code != 200 {
			t.Fatalf("page: %d %s", result.Code, result.Body)
		}
		var created map[string]any
		json.Unmarshal(result.Body.Bytes(), &created)
		id := created["id"].(string)
		result = request("POST", route("page_sections", ""), editor, map[string]any{"page": id, "symbol": symbol.Id, "index": 0})
		if result.Code != 200 {
			t.Fatalf("section: %d %s", result.Code, result.Body)
		}
		var added map[string]any
		json.Unmarshal(result.Body.Bytes(), &added)
		sectionID := added["id"].(string)
		result = request("PATCH", route("page_sections", sectionID), editor, map[string]any{"index": 2})
		if result.Code != 200 {
			t.Fatalf("reorder: %d %s", result.Code, result.Body)
		}
		result = request("DELETE", route("page_sections", sectionID), editor, nil)
		if result.Code != 204 {
			t.Fatalf("delete section: %d %s", result.Code, result.Body)
		}
		result = request("DELETE", route("pages", id), editor, nil)
		if result.Code != 204 {
			t.Fatalf("delete page: %d %s", result.Code, result.Body)
		}
	})
	t.Run("static body structure and unavailable blocks", func(t *testing.T) {
		unavailable := permissionRecord(t, app, "site_symbols", map[string]any{"site": site.Id, "name": "Unavailable"})
		denied(t, request("POST", route("page_sections", ""), editor, map[string]any{"page": page.Id, "symbol": unavailable.Id, "index": 0}))
		available, _ := app.FindAllRecords("page_type_symbols")
		for _, record := range available {
			if record.GetString("page_type") == pageType.Id {
				if err := app.Delete(record); err != nil {
					t.Fatal(err)
				}
			}
		}
		denied(t, request("PATCH", route("page_sections", section.Id), editor, map[string]any{"index": 3}))
		denied(t, request("DELETE", route("page_sections", section.Id), editor, nil))
	})
	t.Run("editor creates static pages from exact template slots", func(t *testing.T) {
		permissionRecord(t, app, "page_type_sections", map[string]any{"page_type": pageType.Id, "symbol": symbol.Id, "zone": "body", "index": 0})
		result := request("POST", route("pages", ""), editor, map[string]any{"site": site.Id, "parent": page.Id, "page_type": pageType.Id, "name": "Static child", "slug": "static-child"})
		if result.Code != 200 {
			t.Fatalf("static page: %d %s", result.Code, result.Body)
		}
		var child map[string]any
		json.Unmarshal(result.Body.Bytes(), &child)
		body := map[string]any{"page": child["id"], "symbol": symbol.Id, "index": 0}
		result = request("POST", route("page_sections", ""), editor, body)
		if result.Code != 200 {
			t.Fatalf("template section: %d %s", result.Code, result.Body)
		}
		var added map[string]any
		json.Unmarshal(result.Body.Bytes(), &added)
		denied(t, request("POST", route("page_sections", ""), editor, body))
		body["index"] = 1
		denied(t, request("POST", route("page_sections", ""), editor, body))
		denied(t, request("DELETE", route("page_sections", added["id"].(string)), editor, nil))
	})

	t.Run("compiled output remains writable for trusted editor publishing", func(t *testing.T) {
		for _, item := range []struct{ collection, id, field, filename, content string }{{"site_symbols", symbol.Id, "compiled_js", "block.js", "export default {}"}, {"pages", page.Id, "compiled_html", "page.html", "<h1>Client approved</h1>"}, {"sites", site.Id, "preview", "preview.html", "<h1>Preview</h1>"}} {
			var buffer bytes.Buffer
			writer := multipart.NewWriter(&buffer)
			file, _ := writer.CreateFormFile(item.field, item.filename)
			fmt.Fprint(file, item.content)
			writer.Close()
			req := httptest.NewRequest("PATCH", route(item.collection, item.id), &buffer)
			req.Header.Set("Authorization", editor)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			result := httptest.NewRecorder()
			handler.ServeHTTP(result, req)
			if result.Code != 200 {
				t.Fatalf("artifact %s: %d %s", item.field, result.Code, result.Body)
			}
		}
	})
	t.Run("custom import rejects editor including localhost dev", func(t *testing.T) {
		previous := DevMode
		DevMode = true
		defer func() { DevMode = previous }()
		req := pushRequest(t, "/api/primo/import/"+site.Id, editor, "", false, archive)
		req.Host = "127.0.0.1"
		req.RemoteAddr = "127.0.0.1:12345"
		result := httptest.NewRecorder()
		handler.ServeHTTP(result, req)
		denied(t, result)
		state, _ := readPushState(app, site.Id)
		req = pushRequest(t, "/api/primo/import/"+site.Id, editor, state.Revision, false, archive)
		result = httptest.NewRecorder()
		handler.ServeHTTP(result, req)
		denied(t, result)
		stored, _ := app.FindRecordById("page_section_entries", entry.Id)
		var value string
		if err := stored.UnmarshalJSONField("value", &value); err != nil || value != "Client approved" {
			t.Fatalf("import changed content: %q (%v)", value, err)
		}
	})
	t.Run("server editors cannot manage accounts or promote themselves", func(t *testing.T) {
		user.Set("serverRole", "editor")
		if err := app.Save(user); err != nil {
			t.Fatal(err)
		}
		token := permissionToken(t, user)
		denied(t, request("PATCH", route("users", user.Id), token, map[string]any{"serverRole": "developer"}))
		denied(t, request("POST", route("users", ""), token, map[string]any{"email": "promoted@example.test", "serverRole": "developer", "password": "password123", "passwordConfirm": "password123"}))
		denied(t, request("PATCH", route("site_symbols", symbol.Id), token, map[string]any{"html": "Bad"}))
	})
	t.Run("site developer retains design access", func(t *testing.T) {
		assignment.Set("role", "developer")
		app.Save(assignment)
		user.Set("serverRole", "")
		app.Save(user)
		result := request("PATCH", route("site_symbols", symbol.Id), permissionToken(t, user), map[string]any{"css": "h1 {color:green}"})
		if result.Code != 200 {
			t.Fatalf("site developer: %d %s", result.Code, result.Body)
		}
	})
}
