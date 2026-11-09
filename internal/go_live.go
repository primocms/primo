package internal

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// The go-live webhook hands the active build to whatever hosts the live site.
// Its body has the shape of GitHub's repository_dispatch, so a GitHub Action
// can receive it directly; any other receiver checks the same bearer header.
var goLiveClient = &http.Client{
	Timeout: 10 * time.Second,
	CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

// How long the download link in a go-live request stays valid. Long enough
// for a queued CI job, short enough not to matter once it leaks into logs.
const goLiveLinkDuration = time.Hour

const goLiveResponseLimit = 4096

func normalizeWebhookURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return "", errors.New("The go-live webhook must be an https:// URL")
	}
	return parsed.String(), nil
}

// publicOrigin is the address external receivers download the build from:
// the configured application URL unless it is the local default, else the
// origin the caller used.
func publicOrigin(app core.App, e *core.RequestEvent) string {
	if configured, err := url.Parse(app.Settings().Meta.AppURL); err == nil && configured.Host != "" &&
		configured.Hostname() != "localhost" && configured.Hostname() != "127.0.0.1" {
		return strings.TrimRight(configured.String(), "/")
	}
	if origin := e.Request.Header.Get("Origin"); strings.HasPrefix(origin, "https://") || strings.HasPrefix(origin, "http://") {
		return origin
	}
	scheme := "http"
	if e.Request.TLS != nil || e.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + e.Request.Host
}

func registerGoLiveEndpoint(pb *pocketbase.PocketBase, event *core.ServeEvent) {
	// Whoever may publish may also hand the published build to the live host.
	event.Router.POST("/api/primo/publication/{siteId}/go-live", func(e *core.RequestEvent) error {
		site, err := authorizePublication(pb, e)
		if err != nil {
			return err
		}
		target, err := normalizeWebhookURL(site.GetString("go_live_webhook_url"))
		if err != nil {
			return e.BadRequestError(err.Error(), nil)
		}
		if target == "" {
			return e.BadRequestError("This site has no go-live webhook.", nil)
		}
		build, err := findActiveBuild(pb, site)
		if errors.Is(err, errNoActiveBuild) {
			return apis.NewApiError(http.StatusConflict, "Publish the site before going live.", nil)
		} else if err != nil {
			return err
		}
		token, err := newArchiveToken(pb, site.Id, build, goLiveLinkDuration)
		if err != nil {
			return err
		}
		body, err := json.Marshal(map[string]any{
			"event_type": "primo_go_live",
			"client_payload": map[string]any{
				"site_id":      site.Id,
				"host":         site.GetString("host"),
				"live_url":     site.GetString("live_url"),
				"revision":     build.Revision,
				"published_at": build.PublishedAt,
				"download_url": publicOrigin(pb, e) + "/api/primo/publication/" + site.Id + "/archive?token=" + url.QueryEscape(token),
				"expires_at":   time.Now().Add(goLiveLinkDuration).UTC().Format(time.RFC3339),
			},
		})
		if err != nil {
			return err
		}
		request, err := http.NewRequestWithContext(e.Request.Context(), http.MethodPost, target, bytes.NewReader(body))
		if err != nil {
			return e.BadRequestError("Invalid go-live webhook", err)
		}
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Accept", "application/vnd.github+json")
		request.Header.Set("User-Agent", "Primo")
		if secret := site.GetString("go_live_webhook_secret"); secret != "" {
			request.Header.Set("Authorization", "Bearer "+secret)
		}
		response, err := goLiveClient.Do(request)
		if err != nil {
			return apis.NewApiError(http.StatusBadGateway, "The go-live webhook could not be reached: "+err.Error(), nil)
		}
		defer response.Body.Close()
		excerpt, _ := io.ReadAll(io.LimitReader(response.Body, goLiveResponseLimit))
		if response.StatusCode < 200 || response.StatusCode > 299 {
			message := strings.TrimSpace(string(excerpt))
			if runes := []rune(message); len(runes) > 300 {
				message = string(runes[:300]) + "…"
			}
			return apis.NewApiError(http.StatusBadGateway, fmt.Sprintf("The go-live webhook answered %d: %s", response.StatusCode, message), nil)
		}
		return e.JSON(http.StatusOK, map[string]any{"ok": true, "revision": build.Revision, "status": response.StatusCode})
	})
}
