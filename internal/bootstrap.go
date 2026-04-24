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
		serveEvent.Router.POST("/api/palacms/bootstrap", func(e *core.RequestEvent) error {
			return handleBootstrap(pb, e)
		})

		return serveEvent.Next()
	})
	return nil
}

func handleBootstrap(pb *pocketbase.PocketBase, e *core.RequestEvent) error {
	// Check if any sites exist - only allow bootstrap when none exist
	// Exception: localhost can always bootstrap (for local dev)
	sites, err := pb.FindAllRecords("sites")
	if err == nil && len(sites) > 0 && !IsLocalhost(e) {
		return e.ForbiddenError("Bootstrap not allowed - sites already exist", nil)
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
		siteHost = "localhost"
	}

	serverGroups, err := parseBootstrapGroups(serverGroupsRaw)
	if err != nil {
		return e.BadRequestError("Invalid server_groups payload", err)
	}
	if err := ensureBootstrapGroups(pb, serverGroups); err != nil {
		return e.InternalServerError("Failed to create site groups", err)
	}

	groupId, err := ensureBootstrapGroup(pb, bootstrapSiteGroup{
		ID:    siteGroupRef,
		Name:  siteGroupName,
		Index: parseGroupIndex(siteGroupIndex),
	})
	if err != nil {
		return e.InternalServerError("Failed to create site group", err)
	}

	// Find existing site or create new one
	sitesColl, err := pb.FindCollectionByNameOrId("sites")
	if err != nil {
		return e.InternalServerError("Failed to find sites collection", err)
	}

	// Try to find existing site by ID first, then by host (for re-bootstrap scenarios)
	site, _ := pb.FindRecordById("sites", siteId)
	if site == nil {
		// Check if a site with this host already exists
		site, _ = pb.FindFirstRecordByData("sites", "host", siteHost)
	}
	if site == nil {
		site = core.NewRecord(sitesColl)
		site.Set("id", siteId)
	}
	site.Set("name", siteName)
	site.Set("host", siteHost)
	site.Set("group", groupId)

	if err := pb.Save(site); err != nil {
		return e.InternalServerError("Failed to create site", err)
	}

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
		result, err := processImport(pb, site, zipData, false)
		if err != nil {
			return e.InternalServerError("Import failed: "+err.Error(), err)
		}

		return e.JSON(200, map[string]interface{}{
			"success":  true,
			"site_id":  siteId,
			"name":     siteName,
			"host":     siteHost,
			"warnings": result.Warnings,
		})
	}

	return e.JSON(200, map[string]interface{}{
		"success": true,
		"site_id": siteId,
		"name":    siteName,
		"host":    siteHost,
	})
}

func ensureDefaultGroup(pb *pocketbase.PocketBase) (string, error) {
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

func ensureBootstrapGroups(pb *pocketbase.PocketBase, groups []bootstrapSiteGroup) error {
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

func ensureBootstrapGroup(pb *pocketbase.PocketBase, group bootstrapSiteGroup) (string, error) {
	groupID := strings.TrimSpace(group.ID)
	groupName := strings.TrimSpace(group.Name)
	if groupName == "" {
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
		existingGroup.Set("name", groupName)
		existingGroup.Set("index", group.Index)
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
		lower := strings.ToLower(part)
		parts[i] = strings.ToUpper(lower[:1]) + lower[1:]
	}

	if len(parts) == 0 {
		return "Default"
	}

	return strings.Join(parts, " ")
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
