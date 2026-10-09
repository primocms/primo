package internal

import (
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

const publicationLease = 15 * time.Minute

func publicationRecord(app core.App, siteID string) (*core.Record, error) {
	record, err := app.FindFirstRecordByData("site_publications", "site", siteID)
	if !errors.Is(err, sql.ErrNoRows) {
		return record, err
	}
	collection, err := app.FindCollectionByNameOrId("site_publications")
	if err != nil {
		return nil, err
	}
	record = core.NewRecord(collection)
	record.Set("site", siteID)
	return record, nil
}

func attemptExpired(record *core.Record) bool {
	started, err := time.Parse(time.RFC3339Nano, record.GetString("attempt_started_at"))
	return err != nil || time.Since(started) > publicationLease
}

func publicationStatus(app core.App, site *core.Record) (map[string]any, error) {
	draft, err := readPushState(app, site.Id)
	if err != nil {
		return nil, err
	}
	record, err := publicationRecord(app, site.Id)
	if err != nil {
		return nil, err
	}
	state := "unknown" // Legacy publications cannot be attributed to a revision.
	published := record.GetString("published_revision")
	var unpublished any
	if published != "" {
		unpublished = draft.Revision != published
		state = "current"
		if unpublished == true {
			state = "behind"
		}
	} else if record.IsNew() || record.GetString("published_at") == "" {
		system, err := app.NewFilesystem()
		if err != nil {
			return nil, err
		}
		exists, err := system.Exists("sites/" + site.GetString("host") + "/index.html")
		system.Close()
		if err != nil {
			return nil, err
		}
		if !exists {
			state = "never_published"
			unpublished = true
		}
	}
	attemptState := record.GetString("attempt_state")
	if attemptState == "publishing" && attemptExpired(record) {
		attemptState = "unknown"
	}
	if attemptState == "publishing" || attemptState == "failed" || attemptState == "unknown" {
		state = attemptState
	}
	host := site.GetString("host")
	var siteURL any
	if host != "" && host != site.Id {
		siteURL = "https://" + host
	}
	return map[string]any{
		"protocol": 1, "site_id": site.Id, "state": state, "draft_revision": draft.Revision,
		"published_revision": published, "unpublished_changes": unpublished,
		"published_at": record.GetString("published_at"), "site_url": siteURL,
		"attempt": map[string]any{"id": record.GetString("attempt_id"), "revision": record.GetString("attempt_revision"),
			"state": attemptState, "started_at": record.GetString("attempt_started_at"),
			"finished_at": record.GetString("attempt_finished_at"), "error": record.GetString("attempt_error")},
	}, nil
}

func authorizePublication(app core.App, e *core.RequestEvent) (*core.Record, error) {
	site, err := app.FindRecordById("sites", e.Request.PathValue("siteId"))
	if err != nil {
		return nil, err
	}
	info, err := e.RequestInfo()
	if err != nil {
		return nil, err
	}
	allowed, err := app.CanAccessRecord(site, info, site.Collection().UpdateRule)
	if err != nil || !allowed {
		return nil, e.ForbiddenError("Publication requires permission to edit this site.", err)
	}
	return site, nil
}

func checkPublicationRevision(state pushState, expected string) error {
	if expected == "" {
		return apis.NewApiError(428, "Publication requires the expected draft revision.", nil)
	}
	if expected != state.Revision {
		return apis.NewApiError(409, "Hosted draft changed during publication. The previous public build remains active. Review the draft and retry publication.", nil)
	}
	return nil
}

func startPublication(app core.App, siteID, revision string) (*core.Record, error) {
	var result *core.Record
	err := app.RunInTransaction(func(tx core.App) error {
		state, err := readPushState(tx, siteID)
		if err != nil {
			return err
		}
		if err := checkPublicationRevision(state, revision); err != nil {
			return err
		}
		record, err := publicationRecord(tx, siteID)
		if err != nil {
			return err
		}
		if record.GetString("attempt_state") == "publishing" && !attemptExpired(record) {
			return apis.NewApiError(409, "Publication is already in progress. Check publication status before retrying.", nil)
		}
		record.Set("attempt_id", security.RandomString(24))
		record.Set("attempt_revision", revision)
		record.Set("attempt_state", "publishing")
		record.Set("attempt_started_at", time.Now().UTC().Format(time.RFC3339Nano))
		record.Set("attempt_finished_at", "")
		record.Set("attempt_error", "")
		if err := tx.Save(record); err != nil {
			return err
		}
		result = record
		return nil
	})
	return result, err
}

func failPublication(app core.App, siteID, attemptID, message string) error {
	cleanup := false
	err := app.RunInTransaction(func(tx core.App) error {
		record, err := publicationRecord(tx, siteID)
		if err != nil {
			return err
		}
		// A delayed failure must never undo a completed or newer publication.
		if record.GetString("attempt_id") != attemptID || record.GetString("attempt_state") != "publishing" {
			return nil
		}
		record.Set("attempt_state", "failed")
		record.Set("attempt_finished_at", time.Now().UTC().Format(time.RFC3339Nano))
		record.Set("attempt_error", string([]rune(message)[:min(len([]rune(message)), 4000)]))
		cleanup = true
		return tx.Save(record)
	})
	if err == nil && cleanup {
		cleanupPublicationPrefix(app, "published/"+siteID+"/"+attemptID)
	}
	return err
}

func activatePublication(pb *pocketbase.PocketBase, site *core.Record, attemptID string) error {
	record, err := publicationRecord(pb, site.Id)
	if err != nil {
		return err
	}
	if attemptID == "" || record.GetString("attempt_id") != attemptID {
		return apis.NewApiError(409, "Publication attempt is no longer current.", nil)
	}
	if record.GetString("attempt_state") == "succeeded" {
		return nil
	} // Retry after a lost response.
	if record.GetString("attempt_state") != "publishing" || attemptExpired(record) {
		return apis.NewApiError(409, "Publication attempt expired or failed. Start publication again.", nil)
	}
	revision := record.GetString("attempt_revision")
	state, err := readPushState(pb, site.Id)
	if err != nil {
		return err
	}
	if err := checkPublicationRevision(state, revision); err != nil {
		return err
	}
	prefix := "published/" + site.Id + "/" + attemptID
	// Render into an immutable directory. Failed builds never change the active files.
	if err := generateSiteAt(pb, site, prefix); err != nil {
		return apis.NewApiError(500, "Publication generation failed: "+err.Error(), err)
	}
	var retiredPrefix string
	err = pb.RunInTransaction(func(tx core.App) error {
		state, err := readPushState(tx, site.Id)
		if err != nil {
			return err
		}
		if err := checkPublicationRevision(state, revision); err != nil {
			return err
		}
		currentSite, err := tx.FindRecordById("sites", site.Id)
		if err != nil {
			return err
		}
		if currentSite.GetString("host") != site.GetString("host") {
			return apis.NewApiError(409, "Site domain changed during publication. Retry publication.", nil)
		}
		record, err := publicationRecord(tx, site.Id)
		if err != nil {
			return err
		}
		if record.GetString("attempt_id") != attemptID || record.GetString("attempt_state") != "publishing" || attemptExpired(record) {
			return apis.NewApiError(409, "Publication attempt is no longer current.", nil)
		}
		now := time.Now().UTC().Format(time.RFC3339Nano)
		retiredPrefix = record.GetString("previous_prefix")
		record.Set("previous_prefix", record.GetString("prefix"))
		record.Set("prefix", prefix)
		record.Set("published_revision", revision)
		record.Set("published_at", now)
		record.Set("attempt_state", "succeeded")
		record.Set("attempt_finished_at", now)
		return tx.Save(record)
	})
	if err == nil {
		cleanupPublicationPrefix(pb, retiredPrefix)
	}
	return err
}

// A legacy editor/dev build has no verified compile revision. Keep its outcome
// visible, without claiming that its compiled artifacts match the current draft.
func recordLegacyPublication(app core.App, siteID string) error {
	record, err := publicationRecord(app, siteID)
	if err != nil {
		return err
	}
	retired := record.GetString("previous_prefix")
	if record.GetString("prefix") != "" {
		record.Set("previous_prefix", record.GetString("prefix"))
	} else {
		retired = ""
	}
	record.Set("prefix", "")
	record.Set("published_revision", "")
	record.Set("published_at", time.Now().UTC().Format(time.RFC3339Nano))
	record.Set("attempt_state", "unknown")
	record.Set("attempt_error", "Published by a client without revision tracking.")
	if err := app.Save(record); err != nil {
		return err
	}
	cleanupPublicationPrefix(app, retired)
	return nil
}

var publicationPrefixPattern = regexp.MustCompile(`^published/[a-z0-9]{15}/[a-zA-Z0-9]{24}$`)

// Retain the active and immediately previous builds. Cleanup is best-effort,
// always restricted to a retired/failed prefix created by this protocol.
func cleanupPublicationPrefix(app core.App, prefix string) {
	if !publicationPrefixPattern.MatchString(prefix) {
		return
	}
	system, err := app.NewFilesystem()
	if err != nil {
		app.Logger().Warn("publication cleanup", "error", err)
		return
	}
	defer system.Close()
	files, err := system.List(prefix + "/")
	if err != nil {
		app.Logger().Warn("publication cleanup", "error", err)
		return
	}
	for _, file := range files {
		if !file.IsDir {
			if err := system.Delete(file.Key); err != nil {
				app.Logger().Warn("publication cleanup", "key", file.Key, "error", err)
			}
		}
	}
}

func RegisterPublicationEndpoints(pb *pocketbase.PocketBase, event *core.ServeEvent) {
	event.Router.GET("/api/primo/publication/{siteId}", func(e *core.RequestEvent) error {
		site, err := authorizePublication(pb, e)
		if err != nil {
			return err
		}
		status, err := publicationStatus(pb, site)
		if err != nil {
			return err
		}
		return e.JSON(http.StatusOK, status)
	})
	event.Router.POST("/api/primo/publication/{siteId}", func(e *core.RequestEvent) error {
		site, err := authorizePublication(pb, e)
		if err != nil {
			return err
		}
		body := struct {
			Revision string `json:"expected_revision"`
		}{}
		if err := e.BindBody(&body); err != nil {
			return e.BadRequestError("Invalid publication request", err)
		}
		record, err := startPublication(pb, site.Id, body.Revision)
		if err != nil {
			return err
		}
		return e.JSON(http.StatusOK, map[string]any{"attempt_id": record.GetString("attempt_id"), "revision": record.GetString("attempt_revision")})
	})
	event.Router.POST("/api/primo/publication/{siteId}/{attemptId}/fail", func(e *core.RequestEvent) error {
		site, err := authorizePublication(pb, e)
		if err != nil {
			return err
		}
		body := struct {
			Error string `json:"error"`
		}{}
		if err := e.BindBody(&body); err != nil {
			return e.BadRequestError("Invalid failure request", err)
		}
		if strings.TrimSpace(body.Error) == "" {
			body.Error = "Publication failed."
		}
		if err := failPublication(pb, site.Id, e.Request.PathValue("attemptId"), body.Error); err != nil {
			return err
		}
		return e.JSON(http.StatusOK, map[string]any{"ok": true})
	})
	event.Router.POST("/api/primo/publication/{siteId}/{attemptId}/activate", func(e *core.RequestEvent) error {
		site, err := authorizePublication(pb, e)
		if err != nil {
			return err
		}
		attemptID := e.Request.PathValue("attemptId")
		record, err := publicationRecord(pb, site.Id)
		if err != nil {
			return err
		}
		revision := record.GetString("attempt_revision")
		if err := activatePublication(pb, site, attemptID); err != nil {
			if failErr := failPublication(pb, site.Id, attemptID, err.Error()); failErr != nil {
				pb.Logger().Error("record publication failure", "error", failErr)
			}
			return err
		}
		var siteURL any
		if host := site.GetString("host"); host != "" && host != site.Id {
			siteURL = "https://" + host
		}
		// Return this attempt's completion receipt. A subsequent publication
		// or CMS edit must not make the caller's successful operation ambiguous.
		return e.JSON(http.StatusOK, map[string]any{"protocol": 1, "site_id": site.Id,
			"attempt_id": attemptID, "revision": revision, "state": "succeeded", "site_url": siteURL})
	})
}
