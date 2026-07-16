import type { Site } from '$lib/common/models/Site'

// A pushed/auto-created site is seeded with `host = id` as a placeholder (see
// import.go: the sites collection has a UNIQUE, required `host`, so "no host"
// can't be empty). That sentinel means "unassigned" — the site is editable in
// the dashboard but not publicly served until an operator assigns a real
// domain. Bootstrap of the very first site on a fresh instance is the one path
// that assigns a real host up front (the deploy URL).
export const is_host_assigned = (site: Pick<Site, 'id' | 'host'>) => !!site.host && site.host !== site.id

// Where to open a site in the editor.
//
// Assigned sites live at their own vhost (`//host/admin/site`) — the host-based
// editor route resolves the site from the request Host. Unassigned sites have
// no reachable vhost, so they're edited by id via the same-origin id-based
// route (`/admin/sites/{id}`), which resolves the site directly and never
// touches `host`.
export const site_editor_url = (site: Pick<Site, 'id' | 'host'>) =>
	is_host_assigned(site) ? `//${site.host}/admin/site` : `/admin/sites/${site.id}`
