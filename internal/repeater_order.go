package internal

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

type repeaterOrderRequest struct {
	Collection string         `json:"collection"`
	Owner      string         `json:"owner"`
	Field      string         `json:"field"`
	Parent     string         `json:"parent"`
	Locale     string         `json:"locale"`
	IDs        []string       `json:"ids"`
	Expected   map[string]int `json:"expected"`
}

type repeaterCollection struct {
	fields, owners, fieldOwner, entryOwner string
}

var repeaterCollections = map[string]repeaterCollection{
	"library_symbol_entries":    {"library_symbol_fields", "library_symbols", "symbol", ""},
	"site_symbol_entries":       {"site_symbol_fields", "site_symbols", "symbol", ""},
	"site_entries":              {"site_fields", "sites", "site", ""},
	"page_type_entries":         {"page_type_fields", "page_types", "page_type", ""},
	"page_entries":              {"page_type_fields", "pages", "page_type", "page"},
	"page_section_entries":      {"site_symbol_fields", "page_sections", "symbol", "section"},
	"page_type_section_entries": {"site_symbol_fields", "page_type_sections", "symbol", "section"},
}

func RegisterRepeaterOrderEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.POST("/api/primo/repeater-order", func(e *core.RequestEvent) error {
			if resolveAuthorMode() == "files" {
				return e.ForbiddenError("Content is managed in files.", nil)
			}
			var request repeaterOrderRequest
			if err := e.BindBody(&request); err != nil {
				return e.BadRequestError("Invalid order.", err)
			}
			info, err := e.RequestInfo()
			if err != nil {
				return err
			}
			items, err := saveRepeaterOrder(e.App, info, request)
			if err != nil {
				return err
			}
			return e.JSON(http.StatusOK, map[string]any{"items": items})
		}).Bind(apis.RequireAuth())
		return e.Next()
	})
	return nil
}

// Validate the complete sibling set and its previous indices inside the same
// transaction as the writes. No list-size batch limit, partial order, or silent
// overwrite of a second editor's reorder. An already-applied order is a safe
// retry after a lost response.
func saveRepeaterOrder(app core.App, info *core.RequestInfo, request repeaterOrderRequest) ([]*core.Record, error) {
	config, ok := repeaterCollections[request.Collection]
	if !ok || request.Owner == "" || request.Field == "" || request.Locale == "" || len(request.IDs) > 10000 {
		return nil, apis.NewBadRequestError("Invalid repeater scope.", nil)
	}
	if info.Auth == nil {
		return nil, apis.NewUnauthorizedError("Sign in to rearrange items.", nil)
	}
	var result []*core.Record
	err := app.RunInTransaction(func(tx core.App) error {
		field, err := tx.FindRecordById(config.fields, request.Field)
		if err != nil || field.GetString("type") != "repeater" {
			return apis.NewBadRequestError("Repeater field not found.", nil)
		}
		owner, err := tx.FindRecordById(config.owners, request.Owner)
		if err != nil {
			return apis.NewBadRequestError("Content owner not found.", nil)
		}
		fieldOwner := request.Owner
		if config.entryOwner != "" {
			fieldOwner = owner.GetString(config.fieldOwner)
		}
		// This custom endpoint saves records directly, so REST request hooks do
		// not run. Apply the same content/design boundary before any writes.
		relations := map[string]string{"site_fields": "site", "site_symbol_fields": "symbol.site", "page_type_fields": "page_type.site"}
		site := permissionSite(tx, field, relations[config.fields])
		if !isSiteDeveloper(tx, info.Auth, site) {
			switch request.Collection {
			case "site_entries", "page_entries", "page_section_entries", "page_type_section_entries":
				// Membership is still checked for every item below.
			default:
				return apis.NewForbiddenError("A developer is required to change site design or settings", nil)
			}
		}
		if field.GetString(config.fieldOwner) != fieldOwner {
			return apis.NewBadRequestError("Field belongs to different content.", nil)
		}
		if request.Parent == "" {
			if field.GetString("parent") != "" {
				return apis.NewBadRequestError("Missing parent item.", nil)
			}
		} else {
			parent, err := tx.FindRecordById(request.Collection, request.Parent)
			if err != nil || parent.GetString("field") != field.GetString("parent") || parent.GetString("locale") != request.Locale || (config.entryOwner != "" && parent.GetString(config.entryOwner) != request.Owner) {
				return apis.NewBadRequestError("Invalid parent item.", nil)
			}
		}
		filter := "field = {:field} && locale = {:locale}"
		// Empty string placeholders in PocketBase's filter parser are encoded
		// as a JSON string; use the literal for root-level relation fields.
		if request.Parent == "" {
			filter += ` && parent = ""`
		} else {
			filter += " && parent = {:parent}"
		}
		params := dbx.Params{"field": request.Field, "parent": request.Parent, "locale": request.Locale, "owner": request.Owner}
		if config.entryOwner != "" {
			filter += fmt.Sprintf(" && %s = {:owner}", config.entryOwner)
		}
		items, err := tx.FindRecordsByFilter(request.Collection, filter, "+index,+id", 0, 0, params)
		if err != nil {
			return err
		}
		byID := make(map[string]*core.Record, len(items))
		targetIndices := make(map[string]int, len(request.IDs))
		for index, id := range request.IDs {
			targetIndices[id] = index
		}
		for _, item := range items {
			// Match the ordinary record-update API's access rules. Nothing about
			// ownership/field/parent/value can be changed by this endpoint.
			updateInfo := info.Clone()
			updateInfo.Method = http.MethodPatch
			updateInfo.Body = map[string]any{"index": targetIndices[item.Id]}
			allowed, err := tx.CanAccessRecord(item, updateInfo, item.Collection().UpdateRule)
			if err != nil || !allowed {
				return apis.NewForbiddenError("You cannot rearrange these items.", nil)
			}
			byID[item.Id] = item
		}
		if len(request.IDs) != len(items) || len(request.Expected) != len(items) {
			return apis.NewApiError(http.StatusConflict, "The list changed. Reload before rearranging it.", nil)
		}
		seen := make(map[string]bool, len(items))
		matchesExpected, alreadyApplied := true, true
		for index, id := range request.IDs {
			item, ok := byID[id]
			if !ok || seen[id] {
				return apis.NewBadRequestError("Order must contain each sibling exactly once.", nil)
			}
			seen[id] = true
			expected, ok := request.Expected[id]
			if !ok || expected != item.GetInt("index") {
				matchesExpected = false
			}
			if item.GetInt("index") != index {
				alreadyApplied = false
			}
		}
		if !matchesExpected && !alreadyApplied {
			return apis.NewApiError(http.StatusConflict, "The order changed. Reload before rearranging it.", nil)
		}
		result = make([]*core.Record, 0, len(items))
		for index, id := range request.IDs {
			item := byID[id]
			if item.GetInt("index") != index {
				item.Set("index", index)
				if err := tx.Save(item); err != nil {
					return err
				}
			}
			result = append(result, item)
		}
		return nil
	})
	return result, err
}
