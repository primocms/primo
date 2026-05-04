package internal

import (
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// resolveAuthorMode reads the sync mode the primo-cli set when spawning
// palacms. The CMS UI uses this to gate editable surfaces — when the CLI
// runs with --author files, CMS edits would be discarded on the next
// pull cycle, so the UI shows a read-only banner instead of letting the
// user make edits that silently vanish. Defaults to "both" when the env
// var is missing or unrecognized so palacms running outside primo dev
// stays fully editable.
func resolveAuthorMode() string {
	mode := os.Getenv("PRIMO_AUTHOR_MODE")
	switch mode {
	case "files", "cms", "both":
		return mode
	default:
		return "both"
	}
}

// IsLocalhost checks if the request is coming from localhost
func IsLocalhost(e *core.RequestEvent) bool {
	host := e.Request.Host
	// Remove port if present
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	return host == "localhost" || host == "127.0.0.1" || strings.HasSuffix(host, ".localhost")
}

// RegisterDevAuthEndpoint registers an endpoint for localhost dev authentication
func RegisterDevAuthEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		// Dev auth endpoint - only works on localhost
		serveEvent.Router.POST("/api/palacms/dev-auth", func(e *core.RequestEvent) error {
			if !IsLocalhost(e) {
				return e.ForbiddenError("Dev auth only available on localhost", nil)
			}

			// Find or create dev user
			devEmail := "dev@pala.local"
			user, err := pb.FindAuthRecordByEmail("users", devEmail)
			if err != nil {
				// Create dev user
				collection, err := pb.FindCollectionByNameOrId("users")
				if err != nil {
					return e.InternalServerError("Users collection not found", err)
				}

				user = core.NewRecord(collection)
				user.Set("email", devEmail)
				user.Set("name", "Dev User")
				user.Set("emailVisibility", true)
				user.Set("serverRole", "developer") // Give full access in dev mode
				user.SetPassword("devpassword123")

				if err := pb.Save(user); err != nil {
					return e.InternalServerError("Failed to create dev user", err)
				}
			}

			// Ensure dev user has developer role (in case user was created previously without it)
			if user.GetString("serverRole") == "" {
				user.Set("serverRole", "developer")
				if err := pb.Save(user); err != nil {
					return e.InternalServerError("Failed to update dev user role", err)
				}
			}

			// Generate auth token
			token, err := user.NewAuthToken()
			if err != nil {
				return e.InternalServerError("Failed to generate token", err)
			}

			return e.JSON(200, map[string]interface{}{
				"token":       token,
				"author_mode": resolveAuthorMode(),
				"record": map[string]interface{}{
					"id":             user.Id,
					"collectionId":   user.Collection().Id,
					"collectionName": user.Collection().Name,
					"email":          user.GetString("email"),
					"name":           user.GetString("name"),
					"serverRole":     user.GetString("serverRole"),
					"verified":       user.Verified(),
					"created":        user.GetString("created"),
					"updated":        user.GetString("updated"),
				},
			})
		})
		return serveEvent.Next()
	})
	return nil
}
