/** @type {import('@sveltejs/kit').ServerLoad} */
// import { redirect } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin'

export const load = async ({ params, locals: { supabase, getSession } }) => {
	if (params.site !== 'playground') {
		return {}
	}

	// const site_id = '96cfa9ac-7ed6-4b1f-9af6-410553d4fd5b'
	// let { page_type: page_type_id } = params
	// const [parent_url = 'index', child_url] = params['page']?.split('/') ?? []
	// const page_url = child_url ?? parent_url

	// const fetch_page = async () => {
	// 	const res = await supabase_admin.from('pages').select('*, site!inner(id), page_type(*)').match({ site: site_id, url: page_url }).single()
	// 	return res.data
	// }

	// const fetch_site = async () => {
	// 	const res = await supabase_admin.from('sites').select('*, subscriptions(*), owner(*)').filter('id', 'eq', site_id).single()
	// 	return res.data
	// }

	// const [site_data, page_data] = await Promise.all([fetch_site(), fetch_page()])

	// console.log({ page_data, site_data })

	// const get = {
	// 	pages: async () => {
	// 		const { data } = await supabase_admin.from('pages').select('*, page_type(*)').match({ site: site_id }).order('created_at', { ascending: true })
	// 		return data
	// 	},
	// 	page_types: async () => {
	// 		const { data } = await supabase_admin.from('page_types').select().match({ site: site_id }).order('created_at', { ascending: true })

	// 		return data
	// 	},
	// 	symbols: async () => {
	// 		const { data } = await supabase_admin.from('symbols').select().match({ site: site_id }).order('created_at', { ascending: false })
	// 		return data
	// 	},
	// 	sections: async () => {
	// 		const { data } = await supabase_admin.from('sections').select('*, page, page_type').match({ page: page_data.id }).order('index', { ascending: true })
	// 		return data
	// 	}
	// }

	// const [pages, page_types, symbols, sections] = await Promise.all([get.pages(), get.page_types(), get.symbols(), get.sections()])

	return {
		session: await getSession()
		// site: site_data,
		// page: page_data,
		// pages,
		// page_types,
		// sections,
		// symbols
	}
}
