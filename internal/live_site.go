package internal

import (
	"errors"
	"net/url"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// normalizeLiveURL accepts an absolute http(s) URL without credentials, query
// or fragment, and drops a trailing slash so page paths can be appended.
// An empty value clears the live URL.
func normalizeLiveURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" ||
		parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("Enter the live site's full address (e.g. https://example.com)")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawPath = ""
	return parsed.String(), nil
}

// siteBaseURL is the public address of a site's pages: its live URL when the
// site is hosted elsewhere, otherwise its host.
func siteBaseURL(site *core.Record) string {
	if live := strings.TrimRight(site.GetString("live_url"), "/"); live != "" {
		return live
	}
	return "https://" + site.GetString("host")
}

func liveSiteResponse(site *core.Record) map[string]any {
	// The webhook secret is write-only: callers only learn whether one is set.
	return map[string]any{
		"live_url":                   site.GetString("live_url"),
		"go_live_webhook_url":        site.GetString("go_live_webhook_url"),
		"go_live_webhook_secret_set": site.GetString("go_live_webhook_secret") != "",
	}
}

// RegisterLiveSiteEndpoints wires the settings for a site whose live copy is
// hosted outside Primo. Same permission as changing the domain.
func RegisterLiveSiteEndpoints(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.GET("/api/primo/sites/{siteId}/live-site", func(e *core.RequestEvent) error {
			site, err := authorizeSiteDomain(pb, e)
			if err != nil {
				return err
			}
			return e.JSON(200, liveSiteResponse(site))
		})
		serveEvent.Router.POST("/api/primo/sites/{siteId}/live-site", func(e *core.RequestEvent) error {
			site, err := authorizeSiteDomain(pb, e)
			if err != nil {
				return err
			}
			body := struct {
				LiveURL string `json:"live_url"`
				// Absent: keep. Empty: clear. The secret is cleared with the URL.
				WebhookURL    *string `json:"go_live_webhook_url"`
				WebhookSecret *string `json:"go_live_webhook_secret"`
			}{}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid request body", err)
			}
			liveURL, err := normalizeLiveURL(body.LiveURL)
			if err != nil {
				return e.BadRequestError(err.Error(), nil)
			}
			site.Set("live_url", liveURL)
			if body.WebhookURL != nil {
				webhookURL, err := normalizeWebhookURL(*body.WebhookURL)
				if err != nil {
					return e.BadRequestError(err.Error(), nil)
				}
				site.Set("go_live_webhook_url", webhookURL)
				if webhookURL == "" {
					site.Set("go_live_webhook_secret", "")
				}
			}
			if body.WebhookSecret != nil && site.GetString("go_live_webhook_url") != "" {
				site.Set("go_live_webhook_secret", strings.TrimSpace(*body.WebhookSecret))
			}
			if err := pb.Save(site); err != nil {
				return e.InternalServerError("Failed to save live site settings", err)
			}
			return e.JSON(200, liveSiteResponse(site))
		})
		return serveEvent.Next()
	})
	return nil
}
