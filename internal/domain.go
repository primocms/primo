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

			if err := applyDomainResult(pb, site, host, result); err != nil {
				return e.InternalServerError("Failed to save domain", err)
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

// applyDomainResult persists the host + domain status/records onto the site.
func applyDomainResult(pb *pocketbase.PocketBase, site *core.Record, host string, result DomainResult) error {
	site.Set("host", host)
	site.Set("domain_status", result.Status)
	site.Set("domain_provider_id", result.ProviderID)
	site.Set("domain_error", result.Error)

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
