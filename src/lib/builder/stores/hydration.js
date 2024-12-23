import _ from 'lodash-es'
import stores from '$lib/builder/stores/data'
import sections from '$lib/builder/stores/data/sections'
import { update as update_site } from '$lib/builder/stores/data/site'
import page_store from '$lib/builder/stores/data/page'
import page_type_store from '$lib/builder/stores/data/page_type'
import { page_loaded } from '$lib/builder/stores/app/misc'
import { Page_Type } from '$lib/builder/factories.js'

/**
 * Hydrates the active site, page, section, and symbol stores for the editor
 * @param {import('$lib').Site_Data} data - Combined data object from the server
 */
export async function hydrate_active_data(data) {
	// stores.sections.set(data.sections)
	stores.pages.set(data.pages)
	stores.page_types.set(data.page_types)
	stores.symbols.set(data.symbols)
	update_site(data.site)
}

export function hydrate_active_page(page_data) {
	page_store.update(store => ({
		...store,
		id: page_data.id,
		name: page_data.name,
		slug: page_data.slug,
		entries: page_data.entries,
		page_type: page_data.page_type,
		parent: page_data.parent
	}))
	// page_store.page_type.set(page_data.page_type)

	sections.set(page_data.sections) 
	// page_store.id.set(page_data.id)
	// page_store.name.set(page_data.name)
	// page_store.slug.set(page_data.slug)
	// page_store.entries.set(page_data.entries)
	page_loaded.set(true)
	page_type_store.set(Page_Type()) // TODO: set this to page type, use when on page and page type pages
}

export async function hydrate_page_type(page_data) {
	page_type_store.set(page_data)
	sections.set(page_data.sections)
}