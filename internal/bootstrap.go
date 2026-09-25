package internal

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"encoding/json"
	"io"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type bootstrapSiteGroup struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Index int    `json:"index"`
}

// RegisterBootstrapEndpoint adds the bootstrap endpoint for first-run setup
// This endpoint only works when no sites exist yet (security measure)
func RegisterBootstrapEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/primo/bootstrap", func(e *core.RequestEvent) error {
			return handleBootstrap(pb, e)
		})

		return serveEvent.Next()
	})
	return nil
}

func handleBootstrap(pb *pocketbase.PocketBase, e *core.RequestEvent) error {
	var response map[string]interface{}
	err := pb.RunInTransaction(func(app core.App) error {
		// Check if any sites exist - only allow bootstrap when none exist.
		// Exception: localhost can always bootstrap (for local dev), and we
		// keep that exception even when the lookup fails so a broken DB on
		// a dev machine doesn't lock the operator out. For non-localhost
		// callers we fail closed: a lookup error is treated as "can't prove
		// no sites exist" → 500, rather than silently allowing bootstrap.
		if !(DevMode && IsLocalhost(e)) {
			sites, err := app.FindAllRecords("sites")
			if err != nil {
				return e.InternalServerError("Failed to check existing sites", err)
			}
			if len(sites) > 0 {
				return e.ForbiddenError("Bootstrap not allowed - sites already exist", nil)
			}
		}

		// Parse form data
		if err := e.Request.ParseMultipartForm(32 << 20); err != nil {
			return e.BadRequestError("Failed to parse form", err)
		}

		// Get site info from form
		siteId := e.Request.FormValue("site_id")
		siteName := e.Request.FormValue("name")
		siteHost := e.Request.FormValue("host")
		siteGroupRef := e.Request.FormValue("group")
		siteGroupName := e.Request.FormValue("group_name")
		siteGroupIndex := e.Request.FormValue("group_index")
		serverGroupsRaw := e.Request.FormValue("server_groups")

		if siteId == "" {
			siteId = generateId(15)
		}
		if siteName == "" {
			siteName = "My Site"
		}
		if siteHost == "" {
			// Fall back to the request's Host so a deploy bootstrapped without
			// an explicit host still matches the domain the user visits in the
			// browser. Older CLIs and direct API calls hit this path.
			siteHost = e.Request.Host
			if siteHost == "" {
				siteHost = "localhost"
			}
		}

		if expected := e.Request.FormValue("expected_revision"); expected != "" {
			state, err := readPushState(app, siteId)
			if err != nil {
				return err
			}
			if err := checkPushRevision(state, expected); err != nil {
				return err
			}
			if state.Exists && e.Request.FormValue("force") == "true" {
				return e.BadRequestError("Use the guarded import endpoint to overwrite existing data with a backup", nil)
			}
		}

		serverGroups, err := parseBootstrapGroups(serverGroupsRaw)
		if err != nil {
			return e.BadRequestError("Invalid server_groups payload", err)
		}
		if err := ensureBootstrapGroups(app, serverGroups); err != nil {
			return e.InternalServerError("Failed to create site groups", err)
		}

		groupId, err := ensureBootstrapGroup(app, bootstrapSiteGroup{
			ID:    siteGroupRef,
			Name:  siteGroupName,
			Index: parseGroupIndex(siteGroupIndex),
		})
		if err != nil {
			return e.InternalServerError("Failed to create site group", err)
		}

		// Find existing site or create new one
		sitesColl, err := app.FindCollectionByNameOrId("sites")
		if err != nil {
			return e.InternalServerError("Failed to find sites collection", err)
		}

		// Try to find existing site by ID first, then by host (for re-bootstrap scenarios)
		site, _ := app.FindRecordById("sites", siteId)
		if site == nil {
			// Check if a site with this host already exists
			site, _ = app.FindFirstRecordByData("sites", "host", siteHost)
		}
		if site != nil && site.Id != siteId && e.Request.FormValue("expected_revision") != "" {
			return e.BadRequestError("Bootstrap host already belongs to another site; no data was changed", nil)
		}
		if site == nil {
			site = core.NewRecord(sitesColl)
			site.Set("id", siteId)
		}
		site.Set("name", siteName)
		site.Set("host", siteHost)
		site.Set("group", groupId)

		if err := app.Save(site); err != nil {
			return e.InternalServerError("Failed to create site", err)
		}

		// Re-bootstrap by host may match a record with a different ID, and
		// PocketBase may regenerate IDs it considers invalid. Return the
		// authoritative persisted ID rather than the request's siteId.
		siteId = site.Id

		// Check for ZIP file upload
		file, _, err := e.Request.FormFile("file")
		if err == nil {
			defer file.Close()

			zipData, err := io.ReadAll(file)
			if err != nil {
				return e.InternalServerError("Failed to read file", err)
			}

			// Validate ZIP
			_, err = zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
			if err != nil {
				return e.BadRequestError("Invalid ZIP file", err)
			}

			// Process import
			result, err := processImport(app, site, zipData, false)
			if err != nil {
				return e.InternalServerError("Import failed: "+err.Error(), err)
			}

			// created_ids carries the uploads manifest (canonical suffixed
			// filenames + record ids) the CLI needs to rename local files and
			// rewrite symbolic `upload: uploads/...` refs. Dropping it here made
			// the first (bootstrap) push skip writeback, so the CLI kept re-sending
			// un-suffixed names on every later push — see the upload dedup fix in
			// import.go's reconcileSiteUploads.
			state, err := readPushState(app, siteId)
			if err != nil {
				return err
			}
			response = map[string]interface{}{
				"revision":    state.Revision,
				"success":     true,
				"site_id":     siteId,
				"name":        siteName,
				"host":        siteHost,
				"group_id":    groupId,
				"warnings":    result.Warnings,
				"created_ids": result.CreatedIDs,
			}
			return nil
		}

		state, err := readPushState(app, siteId)
		if err != nil {
			return err
		}
		response = map[string]interface{}{
			"revision": state.Revision,
			"success":  true,
			"site_id":  siteId,
			"name":     siteName,
			"host":     siteHost,
			"group_id": groupId,
		}
		return nil
	})
	if err != nil {
		return pushImportError(e, err)
	}
	return e.JSON(200, response)
}

func ensureDefaultGroup(pb core.App) (string, error) {
	return ensureBootstrapGroup(pb, bootstrapSiteGroup{
		ID:    "default",
		Name:  "Default",
		Index: 0,
	})
}

func parseBootstrapGroups(raw string) ([]bootstrapSiteGroup, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}

	var groups []bootstrapSiteGroup
	if err := json.Unmarshal([]byte(raw), &groups); err != nil {
		return nil, err
	}

	return groups, nil
}

func parseGroupIndex(raw string) int {
	if strings.TrimSpace(raw) == "" {
		return 0
	}

	index := 0
	for _, char := range raw {
		if char < '0' || char > '9' {
			return 0
		}
		index = (index * 10) + int(char-'0')
	}

	return index
}

func ensureBootstrapGroups(pb core.App, groups []bootstrapSiteGroup) error {
	for index, group := range groups {
		if strings.TrimSpace(group.ID) == "" && strings.TrimSpace(group.Name) == "" {
			continue
		}
		if group.Index == 0 && index != 0 {
			group.Index = index
		}
		if _, err := ensureBootstrapGroup(pb, group); err != nil {
			return err
		}
	}

	return nil
}

func ensureBootstrapGroup(pb core.App, group bootstrapSiteGroup) (string, error) {
	groupID := strings.TrimSpace(group.ID)
	groupName := strings.TrimSpace(group.Name)
	// nameProvided distinguishes "caller passed an explicit name" from
	// "caller only had an ID". On the push path the CLI only knows the group
	// ID, so we must NOT synthesize a name from the ID and then overwrite a
	// user's existing label (e.g. clobbering "Clients" with "8Y17hao5jt2xmd8").
	nameProvided := groupName != ""
	if !nameProvided {
		groupName = humanizeGroupID(groupID)
	}
	if groupName == "" {
		groupName = "Default"
	}
	if len(groupID) < 15 {
		groupID = ""
	}

	var existingGroup *core.Record
	var err error
	if groupID != "" {
		existingGroup, err = pb.FindRecordById("site_groups", groupID)
	}
	if err != nil || existingGroup == nil {
		existingGroup, _ = pb.FindFirstRecordByData("site_groups", "name", groupName)
	}

	if existingGroup != nil {
		if nameProvided {
			existingGroup.Set("name", groupName)
		}
		if group.Index != 0 {
			existingGroup.Set("index", group.Index)
		}
		if err := pb.Save(existingGroup); err != nil {
			return "", err
		}
		return existingGroup.Id, nil
	}

	groupsColl, err := pb.FindCollectionByNameOrId("site_groups")
	if err != nil {
		return "", err
	}

	newGroup := core.NewRecord(groupsColl)
	if groupID == "" {
		groupID = generateId(15)
	}
	newGroup.Set("id", groupID)
	newGroup.Set("name", groupName)
	newGroup.Set("index", group.Index)

	if err := pb.Save(newGroup); err != nil {
		return "", err
	}

	return newGroup.Id, nil
}

func humanizeGroupID(groupID string) string {
	groupID = strings.TrimSpace(groupID)
	if groupID == "" {
		return "Default"
	}

	parts := strings.FieldsFunc(groupID, func(char rune) bool {
		return char == '-' || char == '_' || char == ' '
	})
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = titleCaseFirstLetter(part)
	}

	if len(parts) == 0 {
		return "Default"
	}

	return strings.Join(parts, " ")
}

// titleCaseFirstLetter lowercases the part, then uppercases the first *letter*
// it finds, skipping leading punctuation. So "(claude)" becomes "(Claude)"
// rather than staying lowercase (which is what happened when the old code
// blindly title-cased the first character — ToUpper("(") is a no-op). This
// makes folder names like "layout-(claude)" round-trip to "Layout (Claude)".
func titleCaseFirstLetter(part string) string {
	lower := strings.ToLower(part)
	runes := []rune(lower)
	for i, r := range runes {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			runes[i] = []rune(strings.ToUpper(string(r)))[0]
			return string(runes)
		}
	}
	return lower
}

func generateId(length int) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	if _, err := rand.Read(result); err != nil {
		for i := range result {
			result[i] = chars[i%len(chars)]
		}
		return string(result)
	}
	for i, value := range result {
		result[i] = chars[int(value)%len(chars)]
	}
	return string(result)
}
