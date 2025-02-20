import { redirect } from '@sveltejs/kit'
import _ from 'lodash-es'

/** @type {import('@sveltejs/kit').ServerLoad} */
export async function load(event) {
	event.depends('app:data')

	const { supabase, session } = await event.parent()

	// Get site and page
	const { site: site_id, page: page_url, page_type: page_type_id } = event.params
	const url_segments = page_url?.split('/') ?? []
	const page_slug = url_segments.at(-1) ?? ''

	const fetch_site = async () => {
		const res = await supabase.from('sites').select('*, fields!fields_site_fkey(*), entries!entries_site_fkey(*)').filter('id', 'eq', site_id).single()
		return res.data
	}

	const fetch_page = async () => {
		if (!page_type_id) {
			const res = await supabase.from('pages').select('*, entries(*), page_type!inner(*, fields(*), entries(*), sections(*))').match({ 'owner_site': site_id, slug: page_slug }).single()
			return res.data
		} else return null
	}

	const [site_data, page_data] = await Promise.all([fetch_site(), fetch_page()])

	if (!page_data && page_slug !== '') {
		throw redirect(303, `/${site_id}/index`)
	} else if (!page_data) {
		// handle misc requests from preview html (i.e. /_symbols/ etc)
		// throw redirect(303, `/`)
	}

	const get = {
		collaborator: async () => {
			const { data } = await supabase.from('collaborators').select('*').match({ user: session.user.id, owner_site: site_id }).maybeSingle()
			return data
		},
		pages: async () => {
			const { data } = await supabase.from('pages').select('*, entries(*)').eq('owner_site', site_id).order('created_at', { ascending: true })
			return data
		},
		page_types: async () => {
			const { data } = await supabase.from('page_types').select('*, fields(*), entries(*)').match({ owner_site: site_id }).order('created_at', { ascending: true })
			return data
		},
		symbols: async () => {
			const { data } = await supabase.from('symbols').select('*, entries(*), fields(*)').match({ owner_site: site_id }).order('created_at', { ascending: false })
			return data
		},
		sections: async () => {
			if (page_type_id) {
				const { data = [], error } = await supabase.from('sections').select('*, entries(*)').eq('page_type', page_type_id).order('index', { ascending: true })
				return data
			} else {
				const { data = [] } = await supabase.from('sections').select('*, page, page_type, entries(*), master(id, symbol, index)').match({ page: page_data.id }).order('index', { ascending: true })
				return data
			}
		}
	}

	const [collaborator, pages, page_types, symbols, sections] = await Promise.all([get.collaborator(), get.pages(), get.page_types(), get.symbols(), get.sections()])

	let page_type = null
	if (page_type_id) {
		const { data } = await supabase.from('page_types').select('*, fields(*), entries(*)').eq('id', page_type_id).single()
		page_type = data
	}

	return {
		role: collaborator?.role || 'DEV',
		site: site_data,
		page: page_data,
		page_type,
		pages,
		page_types,
		sections,
		symbols
	}
}
