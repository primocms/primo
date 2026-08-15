package internal

import (
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// hostPattern is a permissive hostname validator: dot-separated DNS labels
// (letters/digits/hyphens, no leading/trailing hyphen), optionally a leading
// "*." for wildcard custom domains. It rejects schemes, ports, paths, and
// spaces so a bad value can't become a routing host.
var hostPattern = regexp.MustCompile(`^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$`)

// RegisterDomainEndpoints wires the custom-domain connect + status routes. The
// heavy platform work is delegated to the configured DomainProvider; these
// handlers own auth, validation, and persisting status onto the site record.
func RegisterDomainEndpoints(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		// Attach (or change) a custom domain for a site.
		serveEvent.Router.POST("/api/primo/sites/{siteId}/domain", func(e *core.RequestEvent) error {
			site, err := authorizeSiteDomain(pb, e)
			if err != nil {
				return err
			}

			body := struct {
				Host string `json:"host"`
			}{}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid request body", err)
			}
			host := strings.ToLower(strings.TrimSpace(body.Host))
			if !hostPattern.MatchString(host) {
				return e.BadRequestError("Enter a valid domain (e.g. example.com)", nil)
			}

			// Uniqueness: no other site may already own this host.
			if existing, _ := pb.FindFirstRecordByData("sites", "host", host); existing != nil && existing.Id != site.Id {
				return e.BadRequestError("That domain is already in use by another site.", nil)
			}

			result, err := getDomainProvider().AttachDomain(host)
			if err != nil {
				return e.BadRequestError("Failed to attach domain: "+err.Error(), err)
			}

			oldHost := site.GetString("host")
			if err := applyDomainResult(pb, site, host, result); err != nil {
				return e.InternalServerError("Failed to save domain", err)
			}

			// Published files live under sites/{host}/..., so a host change would
			// otherwise 404 at the new domain until the user re-publishes.
			// Regenerate under the new host so the site is served immediately,
			// then tear down the old host's tree — the file server routes purely
			// by Host header, so leaving it would keep serving the site at the
			// old domain. Both are best-effort: a site with nothing published yet
			// has nothing to render, so don't fail the attach if either errors.
			if host != oldHost {
				if genErr := GenerateSite(pb, site); genErr != nil {
					e.App.Logger().Warn("regenerate after domain change failed", "site", site.Id, "host", host, "error", genErr)
				}
				if oldHost != "" && oldHost != site.Id {
					if delErr := DeleteSiteHostFiles(pb, oldHost); delErr != nil {
						e.App.Logger().Warn("cleanup of old host files failed", "site", site.Id, "old_host", oldHost, "error", delErr)
					}
				}
			}

			return e.JSON(200, domainResponse(site, result))
		})

		// Re-check the status of a site's attached custom domain.
		serveEvent.Router.GET("/api/primo/sites/{siteId}/domain/status", func(e *core.RequestEvent) error {
			site, err := authorizeSiteDomain(pb, e)
			if err != nil {
				return err
			}

			result, err := getDomainProvider().DomainStatus(site.GetString("domain_provider_id"), site.GetString("host"))
			if err != nil {
				return e.BadRequestError("Failed to check domain status: "+err.Error(), err)
			}

			// Persist the refreshed status/records but keep the existing host.
			if err := applyDomainResult(pb, site, site.GetString("host"), result); err != nil {
				return e.InternalServerError("Failed to save domain status", err)
			}
			return e.JSON(200, domainResponse(site, result))
		})

		return serveEvent.Next()
	})
	return nil
}

// authorizeSiteDomain resolves the {siteId} route param and enforces that the
// caller may update it (same rule the import/clone paths use). Localhost dev is
// exempt, matching the rest of the codebase.
func authorizeSiteDomain(pb *pocketbase.PocketBase, e *core.RequestEvent) (*core.Record, error) {
	siteId := e.Request.PathValue("siteId")
	if siteId == "" {
		return nil, e.BadRequestError("Missing site ID", nil)
	}
	if e.Auth == nil && !IsLocalhost(e) {
		return nil, e.UnauthorizedError("Authentication required", nil)
	}
	site, err := pb.FindRecordById("sites", siteId)
	if err != nil {
		return nil, e.NotFoundError("Site not found", err)
	}
	if !IsLocalhost(e) {
		info, err := e.RequestInfo()
		if err != nil {
			return nil, e.InternalServerError("Failed to get request info", err)
		}
		if canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().UpdateRule); !canAccess {
			return nil, e.ForbiddenError("Access denied", nil)
		}
	}
	return site, nil
}

// domainErrorMax mirrors the domain_error TextField Max in the migration.
// applyDomainResult truncates to it so a verbose provider error can never fail
// the save (which would turn a transient error into a permanent status-refresh
// 500).
const domainErrorMax = 500

// applyDomainResult persists the host + domain status/records onto the site.
//
// It is deliberately defensive against half-results from a provider poll: a
// transient/out-of-band null from Railway yields a zero-value DomainResult
// (empty ProviderID, "pending" status, no records). Blindly persisting that
// would wipe the real provider id — after which every subsequent status poll
// trips the empty-id guard and the domain is stuck forever. So we only advance
// the provider id when the new result actually carries one.
func applyDomainResult(pb *pocketbase.PocketBase, site *core.Record, host string, result DomainResult) error {
	site.Set("host", host)
	site.Set("domain_status", result.Status)
	// Never overwrite a known provider id with an empty one — an empty id in a
	// result means "couldn't resolve the domain this poll", not "the domain lost
	// its id". Keep the last good id so polling can recover.
	if result.ProviderID != "" {
		site.Set("domain_provider_id", result.ProviderID)
	}

	domainErr := result.Error
	if len(domainErr) > domainErrorMax {
		domainErr = domainErr[:domainErrorMax]
	}
	site.Set("domain_error", domainErr)

	// Store the records as real JSON (the column is a JSONField). Ensure a
	// non-nil slice so it persists as [] rather than null.
	records := result.Records
	if records == nil {
		records = []DNSRecord{}
	}
	site.Set("domain_dns_records", records)
	return pb.Save(site)
}

func domainResponse(site *core.Record, result DomainResult) map[string]any {
	return map[string]any{
		"host":    site.GetString("host"),
		"status":  result.Status,
		"records": result.Records,
		"error":   result.Error,
	}
}
