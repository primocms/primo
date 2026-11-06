import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'
import { Pages, Sites } from './pocketbase/collections'

/**
 * Resolve page from path
 *
 * This function should be called reactively (e.g. inside `$deferred`). While
 * a new page is being fetched, it returns the last resolved page for the same
 * site. This avoids flashing empty content or cross-site stale pages during
 * route transitions and ensures we never return a page from a different site.
 *
 * Internally, a small per-site cache (keyed by `site.id`) stores the most
 * recently resolved page so that switching paths within the same site can show
 * the previous page until the new one loads.
 *
 * @param site Site the pages should belong in
 * @param path Path segments
 * @returns Resolved page, or the last known page for the same site while fetching
 */
const last_page_by_site = new Map<string, ObjectOf<typeof Pages> | undefined>()
export const resolve_page = (site: ObjectOf<typeof Sites>, path: string[]) => {
	if (!site || !path) {
		return
	}

	let page = site.homepage()
	if (!page) {
		return last_page_by_site.get(site.id)
	}

	for (const slug of path) {
		page = Pages.list({
			filter: {
				site: site.id,
				slug,
				parent: page.id
			}
		})?.[0]
		if (!page) {
			return last_page_by_site.get(site.id)
		}
	}

	last_page_by_site.set(site.id, page)
	return page
}

/**
 * Build page editing URL
 *
 * This function should be called reactively (eg. inside $deferred).
 */
export const build_cms_page_url = (page: ObjectOf<typeof Pages>, current_url: Pick<URL, 'pathname' | 'href'>) => {
	const path = build_page_path(page)
	if (!path) {
		return
	}

	const base_path = current_url.pathname.includes('/sites/') ? `/admin/sites/${page.site}` : '/admin/site'
	path.push(base_path)

	return new URL(path.reverse().join('/'), current_url.href)
}

/**
 * Build page URL (eg. for a link)
 *
 * This function should be called reactively (eg. inside $deferred).
 */
export const build_live_page_url = (page: ObjectOf<typeof Pages>) => {
	const site = Sites.one(page.site)
	if (!site) {
		return
	}

	const path = build_page_path(page)
	if (!path) {
		return
	}

	const base_path = ''
	path.push(base_path)

	return new URL(path.reverse().join('/'), site.host ? `${location.protocol}//${site.host}` : location.origin)
}

const build_page_path = (page: ObjectOf<typeof Pages>) => {
	let path: string[] = []
	let current_page: ObjectOf<typeof Pages> | undefined | null = page
	while (current_page?.parent) {
		path.push(current_page.slug)
		current_page = Pages.one(current_page.parent)
		if (!current_page) {
			return
		}
	}
	return path
}
