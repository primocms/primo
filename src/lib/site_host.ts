import type { Site } from '$lib/common/models/Site'
import { instance } from '$lib/instance'

// A pushed/auto-created site is seeded with `host = id` as a placeholder (see
// import.go: the sites collection has a UNIQUE, required `host`, so "no host"
// can't be empty). That sentinel means "unassigned" — the site is editable in
// the dashboard but not publicly served until an operator assigns a real
// domain. Bootstrap of the very first site on a fresh instance is the one path
// that assigns a real host up front (the deploy URL).
export const is_host_assigned = (site: Pick<Site, 'id' | 'host'>) => !!site.host && site.host !== site.id

// Whether `host` sits under the configured base domain — a "<slug>.<base>"
// subdomain that the wildcard cert/routing already covers, so it's reachable
// the moment it's stored (no per-domain DNS/cert work). Mirrors
// isSubdomainOfBase in internal/domains.go.
export const is_base_subdomain = (host: string) => {
	const base = instance.base_domain
	if (!base) return false
	return host === base || host.endsWith(`.${base}`)
}

// Whether the site's assigned host will actually resolve/serve right now.
// Assigning a domain stores it optimistically (status "verifying"/"pending" for
// a custom domain, or empty for an auto-assigned base subdomain), but a custom
// domain isn't reachable until its DNS + cert land ("live"). Base-domain
// subdomains are reachable immediately. Used to keep the dashboard from linking
// a card at a domain that would dead-end on a connection error.
export const is_host_reachable = (site: Pick<Site, 'id' | 'host' | 'domain_status'>) =>
	is_host_assigned(site) && (is_base_subdomain(site.host) || site.domain_status === 'live')

// Where to open a site in the editor.
//
// A reachable assigned host lives at its own vhost (`//host/admin/site`) — the
// host-based editor route resolves the site from the request Host. Unassigned
// sites (and assigned-but-not-yet-reachable ones, e.g. a custom domain still
// waiting on DNS) have no reachable vhost, so they're edited by id via the
// same-origin id-based route (`/admin/sites/{id}`), which resolves the site
// directly and never touches `host` — this avoids dead-ending on a domain that
// isn't connected yet.
export const site_editor_url = (site: Pick<Site, 'id' | 'host' | 'domain_status'>) =>
	is_host_reachable(site) ? `//${site.host}/admin/site` : `/admin/sites/${site.id}`
