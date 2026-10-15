package internal

import (
	"reflect"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func isSiteDeveloper(app core.App, auth *core.Record, site string) bool {
	if auth == nil {
		return false
	}
	if auth.IsSuperuser() || auth.GetString("serverRole") == "developer" {
		return true
	}
	if site == "" {
		return false
	}
	record, err := app.FindFirstRecordByFilter("site_role_assignments", "site = {:site} && user = {:user} && role = 'developer'", dbx.Params{"site": site, "user": auth.Id})
	return err == nil && record != nil
}

// Resolve ownership from stored relations, never from client-supplied expansions.
func permissionSite(app core.App, record *core.Record, relation string) string {
	if relation == "" {
		return record.Id
	}
	parts := strings.Split(relation, ".")
	for i, name := range parts {
		id := record.GetString(name)
		if i == len(parts)-1 {
			return id
		}
		field, ok := record.Collection().Fields.GetByName(name).(*core.RelationField)
		if !ok {
			return ""
		}
		next, err := app.FindRecordById(field.CollectionId, id)
		if err != nil {
			return ""
		}
		record = next
	}
	return ""
}

func onlyPermissionFields(record *core.Record, allowed ...string) bool {
	original := record.Original()
	for _, field := range record.Collection().Fields {
		name := field.GetName()
		if name == "updated" {
			continue
		}
		if reflect.DeepEqual(record.Get(name), original.Get(name)) {
			continue
		}
		found := false
		for _, candidate := range allowed {
			if candidate == name {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// The collection rules remain the membership boundary. These hooks add role
// and field restrictions to every REST mutation, including batch requests.
// Compiled artifacts remain writable for trusted editors to publish; this is
// a source-design boundary, not a sandbox against executable output uploads.
func RegisterContentPermissions(pb *pocketbase.PocketBase) error {
	scopes := map[string]string{
		"site_groups": "", "library_symbol_groups": "", "library_symbols": "", "library_symbol_fields": "", "library_symbol_entries": "",
		"sites": "", "site_fields": "site", "site_entries": "field.site",
		"site_symbols": "site", "site_symbol_fields": "symbol.site", "site_symbol_entries": "field.symbol.site",
		"page_types": "site", "page_type_fields": "page_type.site", "page_type_entries": "field.page_type.site",
		"page_type_symbols": "page_type.site", "page_type_sections": "page_type.site", "page_type_section_entries": "section.page_type.site",
		"pages": "site", "page_sections": "page.site", "page_entries": "page.site", "page_section_entries": "section.page.site",
		"site_uploads": "site", "site_snapshots": "site", "site_role_assignments": "site",
	}
	for collection, relation := range scopes {
		for _, operation := range []string{"create", "update", "delete"} {
			handler := func(e *core.RecordRequestEvent) error {
				site := permissionSite(e.App, e.Record, relation)
				originalSite := site
				if operation != "create" {
					originalSite = permissionSite(e.App, e.Record.Original(), relation)
				}
				if isSiteDeveloper(e.App, e.Auth, originalSite) && isSiteDeveloper(e.App, e.Auth, site) {
					return e.Next()
				}
				deny := func() error {
					return e.ForbiddenError("A developer is required to change site design or settings", nil)
				}
				// Retargeting a record must not borrow developer authority from its new site.
				if e.Auth == nil {
					return deny()
				}
				if e.Auth.GetString("serverRole") != "editor" {
					membership, err := e.App.FindFirstRecordByFilter("site_role_assignments", "site = {:site} && user = {:user} && (role = 'editor' || role = 'developer')", dbx.Params{"site": site, "user": e.Auth.Id})
					if err != nil || membership == nil {
						return deny()
					}
				}
				if site == "" || originalSite != site {
					return deny()
				}
				switch collection {
				case "sites":
					if operation != "update" || !onlyPermissionFields(e.Record, "preview") {
						return deny()
					}
				case "site_symbols":
					if operation != "update" || !onlyPermissionFields(e.Record, "compiled_js", "compiled_js_hash") {
						return deny()
					}
				case "pages":
					if operation == "create" {
						if e.Record.GetString("parent") == "" {
							return deny()
						}
					} else if operation == "update" {
						if !onlyPermissionFields(e.Record, "name", "slug", "parent", "index", "compiled_html", "compiled_html_hash") {
							return deny()
						}
						if (e.Record.GetString("parent") == "") != (e.Record.Original().GetString("parent") == "") {
							return deny()
						}
					} else if e.Record.GetString("parent") == "" {
						return deny()
					}
				case "page_sections":
					if operation == "update" && !onlyPermissionFields(e.Record, "index") {
						return deny()
					}
					page, err := e.App.FindRecordById("pages", e.Record.GetString("page"))
					if err != nil {
						return deny()
					}
					count, err := e.App.CountRecords("page_type_symbols", dbx.HashExp{"page_type": page.GetString("page_type")})
					if err != nil {
						return deny()
					}
					if operation == "create" {
						available, err := e.App.CountRecords("page_type_symbols", dbx.HashExp{"page_type": page.GetString("page_type"), "symbol": e.Record.GetString("symbol")})
						if err != nil {
							return deny()
						}
						if available == 0 {
							// Page creation copies developer-defined body slots, including
							// static types and blocks excluded from the add-block picker.
							// Check occupancy and save together to prevent duplicate slots.
							return e.App.RunInTransaction(func(app core.App) error {
								matches, err := app.CountRecords("page_type_sections", dbx.HashExp{"page_type": page.GetString("page_type"), "zone": "body", "symbol": e.Record.GetString("symbol"), "index": e.Record.GetInt("index")})
								if err != nil || matches == 0 {
									return deny()
								}
								occupied, err := app.CountRecords("page_sections", dbx.HashExp{"page": page.Id, "index": e.Record.GetInt("index")})
								if err != nil || occupied != 0 {
									return deny()
								}
								previous := e.App
								e.App = app
								defer func() { e.App = previous }()
								return e.Next()
							})
						}
					} else if count == 0 {
						return deny()
					}

				case "site_entries", "page_entries", "page_section_entries", "page_type_section_entries":
					if operation == "update" && !onlyPermissionFields(e.Record, "value", "locale", "index", "parent") {
						return deny()
					}
					if parent := e.Record.GetString("parent"); parent != "" {
						record, err := e.App.FindRecordById(collection, parent)
						if err != nil || permissionSite(e.App, record, relation) != site {
							return deny()
						}
						// Parents must belong to the same page/section, not just the same site.
						for _, owner := range []string{"page", "section"} {
							if record.GetString(owner) != e.Record.GetString(owner) {
								return deny()
							}
						}
					}
				case "site_uploads":
					if operation == "update" && e.Record.GetString("site") != e.Record.Original().GetString("site") {
						return deny()
					}
				case "site_snapshots":
					if operation != "create" {
						return deny()
					}
				default:
					return deny()
				}
				return e.Next()
			}
			switch operation {
			case "create":
				pb.OnRecordCreateRequest(collection).BindFunc(handler)
			case "update":
				pb.OnRecordUpdateRequest(collection).BindFunc(handler)
			case "delete":
				pb.OnRecordDeleteRequest(collection).BindFunc(handler)
			}
		}
	}
	return nil
}
