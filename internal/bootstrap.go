package internal

import (
	"archive/zip"
	"bytes"
	"io"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

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

	if siteId == "" {
		siteId = generateId(15)
	}
	if siteName == "" {
		siteName = "My Site"
	}
	if siteHost == "" {
		siteHost = "localhost"
	}

	// Create or find default site group
	groupId, err := ensureDefaultGroup(pb)
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
		_, err = processImport(pb, site, zipData, false)
		if err != nil {
			return e.InternalServerError("Import failed: "+err.Error(), err)
		}
	}

	return e.JSON(200, map[string]interface{}{
		"success": true,
		"site_id": siteId,
		"name":    siteName,
		"host":    siteHost,
	})
}

func ensureDefaultGroup(pb *pocketbase.PocketBase) (string, error) {
	// Try to find existing default group
	groups, err := pb.FindAllRecords("site_groups")
	if err == nil && len(groups) > 0 {
		return groups[0].Id, nil
	}

	// Create default group
	groupsColl, err := pb.FindCollectionByNameOrId("site_groups")
	if err != nil {
		return "", err
	}

	group := core.NewRecord(groupsColl)
	group.Set("name", "Default")

	if err := pb.Save(group); err != nil {
		return "", err
	}

	return group.Id, nil
}

func generateId(length int) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = chars[i%len(chars)]
	}
	return string(result)
}
