import supabase from './lib/supabase/core'
import { page } from '$app/stores'
import { get } from 'svelte/store'
import * as actions from '$lib/builder/actions/active_site'
import _ from 'lodash-es'
import axios from 'axios'
import scramble_ids from './scramble_ids'
import * as code_generators from '$lib/builder/code_generators'
import { processCode } from '$lib/builder/utils'
import { get_content_with_synced_values } from '$lib/builder/stores/helpers'

export const sites = {
	create: async (data, preview = null) => {

		const scrambled = scramble_ids(data)
		const files = await build_site_bundle(scrambled)
		const prepared_data = prepare_data(scrambled)

		const { site, page_types, pages, symbols, sections, entries, fields } = prepared_data

		try {
			// Step 1: Insert site
			let res = await supabase.from('sites').insert({ ...site, owner: get(page).data.user.id })
			if (res.error) {
				console.log('Failed to insert site', { res, site })
				throw new Error('Failed to insert site')
			}

			// Step 2: Insert page_types and symbols
			res = await Promise.all([
				supabase.from('page_types').insert(page_types),
				supabase.from('symbols').insert(symbols)
			])
			if (res.some(r => r.error)) {
				console.log('Failed to insert page_types or symbols', { res, page_types, symbols })
				throw new Error('Failed to insert page_types or symbols')
			}

			// Step 3: Insert pages
			res = await supabase.from('pages').insert(pages)
			if (res.error) {
				console.log('Failed to insert pages', { res, pages })
				throw new Error('Failed to insert pages')
			}

			// Step 4: Insert sections
			res = await supabase.from('sections').insert(sections)
			if (res.error) {
				console.log('Failed to insert sections', { res, sections })
				throw new Error('Failed to insert sections')
			}

			// Step 5: Insert fields
			res = await supabase.from('fields').insert(fields)
			if (res.error) {
				console.log('Failed to insert fields', { res, fields })
				throw new Error('Failed to insert fields')
			}

			// Step 6: Insert entries
			res = await supabase.from('entries').insert(entries)
			if (res.error) {
				console.log('Failed to insert entries', { res, entries })
				throw new Error('Failed to insert entries')
			}

			// Handle preview upload
			if (preview) {
				await supabase.storage.from('sites').upload(`${site.id}/preview.html`, preview)
			}

			// create distribution
			const dist_res = await axios.post('/api/deploy/initial-deployment', {files, site_id: site.id, domain_name: site.domain_name})
			console.log({dist_res})

			console.log('Site created successfully')
		} catch (e) {
			console.error('SOMETHING WENT WRONG', e)
				// TODO: Implement rollback logic to delete inserted items if an error occurs
		}
	},
	update: async (props) => {
		actions.active_site.update(props)
	},
	delete: async (site_id) => {
		await supabase.from('sites').delete().eq('id', site_id)
		await axios.delete(`/api/deploy/delete-deployment?site_id=${site_id}`)
	},
	deploy: async (site_id, custom_domain = null) => {

		const { data, error } = await supabase
			.from('sites')
			.select(`
				*,
				fields(*),
				entries(*),
				page_types(
					*,
					fields(*),
					entries(*),
					pages(
						*,
						entries(*),
						sections(*, entries(*))
					)
				),
				symbols(
					*,
					fields(*),
					entries(*)
				)
			`)
			.eq('id', site_id)
			.single()

			console.log({error, data})

			if (!data) {
				throw new Error('Could not find site')
			}

		const site_data = {
			site: _.omit(data, ['pages', 'page_types', 'symbols', 'sections']),
			pages: data.page_types.flatMap(pt => pt.pages.map(p => _.omit(p, ['sections']))), 
			page_types: data.page_types.map(pt => _.omit(pt, ['pages'])),
			symbols: data.symbols,
			sections: data.page_types.flatMap(pt => pt.pages.flatMap(p => p.sections))
		}

		console.log({site_data})

		// const scrambled = scramble_ids(site_data)
		const files = await build_site_bundle(site_data)
		const prepared_data = prepare_data(site_data)

		const { site } = prepared_data

		try {
			// create distribution
			const dist_res = await axios.post('/api/deploy/initial-deployment', {files, site_id: site.id, domain_name: site.domain_name})
			console.log({dist_res})

			console.log('Site created successfully')
		} catch (e) {
			console.error('SOMETHING WENT WRONG', e)
				// TODO: Implement rollback logic to delete inserted items if an error occurs
		}
	}
}

function prepare_data(data) {

	// Prepare data while maintaining relationships
	const site = _.omit(data.site, ['entries', 'fields'])
	const page_types = data.page_types.map((pt) => _.omit(pt, ['entries', 'fields']))
	const pages = data.pages.map((page) => _.omit(page, ['entries']))
	const sections = data.sections.map((section) => _.omit(section, ['entries']))
	const symbols = data.symbols.map((symbol) => _.omit(symbol, ['entries', 'fields']))
	const sorted_fields = sort_fields_by_hierarchy([...data.site.fields, ...data.page_types.flatMap((pt) => pt.fields), ...data.symbols.flatMap((s) => s.fields)])
	const sorted_entries = sort_entries_by_hierarchy([
		...data.site.entries,
		...data.page_types.flatMap((pt) => pt.entries),
		...data.pages.flatMap((p) => p.entries),
		...data.sections.flatMap((s) => s.entries),
		...data.symbols.flatMap((s) => s.entries)
	])

	return {
		site,
		page_types,
		pages: sort_pages_by_hierarchy(pages),
		sections: sort_sections_by_hierarchy(sections),
		symbols,
		fields: sorted_fields,
		entries: sorted_entries
	}

	function sort_pages_by_hierarchy(pages) {
		const page_map = new Map(pages.map(page => [page.id, page]))
		const sorted = []
		const visited = new Set()
		const temp_visited = new Set()
	
		function dfs(page_id) {
			if (temp_visited.has(page_id)) {
				throw new Error('Circular dependency detected in pages')
			}
			if (visited.has(page_id)) return
	
			temp_visited.add(page_id)
			const page = page_map.get(page_id)
			
			if (page.parent && page_map.has(page.parent)) {
				dfs(page.parent)
			}
	
			temp_visited.delete(page_id)
			visited.add(page_id)
			sorted.push(page)
		}
	
		for (const page of pages) {
			if (!visited.has(page.id)) {
				dfs(page.id)
			}
		}
	
		return sorted
	}
	
	function sort_sections_by_hierarchy(sections) {
		const section_map = new Map(sections.map(section => [section.id, section]))
		const sorted = []
		const visited = new Set()
		const temp_visited = new Set()
	
		function dfs(section_id) {
			if (temp_visited.has(section_id)) {
				throw new Error('Circular dependency detected in sections')
			}
			if (visited.has(section_id)) return
	
			temp_visited.add(section_id)
			const section = section_map.get(section_id)
			
			if (section.master && section_map.has(section.master)) {
				dfs(section.master)
			}
			if (section.palette && section_map.has(section.palette)) {
				dfs(section.palette)
			}
	
			temp_visited.delete(section_id)
			visited.add(section_id)
			sorted.push(section)
		}
	
		for (const section of sections) {
			if (!visited.has(section.id)) {
				dfs(section.id)
			}
		}
	
		return sorted
	}
	
	function sort_fields_by_hierarchy(fields) {
		const field_map = new Map(fields.map(field => [field.id, field]))
		const sorted = []
		const visited = new Set()
		const temp_visited = new Set()
	
		function dfs(field_id) {
			if (temp_visited.has(field_id)) {
				throw new Error('Circular dependency detected in fields')
			}
			if (visited.has(field_id)) return
	
			temp_visited.add(field_id)
			const field = field_map.get(field_id)
			
			if (field.parent && field_map.has(field.parent)) {
				dfs(field.parent)
			}
			if (field.options?.source && field_map.has(field.options.source)) {
				dfs(field.options.source)
			}
			// Note: options.page_type is not a field ID, so we don't need to sort based on it
	
			temp_visited.delete(field_id)
			visited.add(field_id)
			sorted.push(field)
		}
	
		for (const field of fields) {
			if (!visited.has(field.id)) {
				dfs(field.id)
			}
		}
	
		return sorted
	}
	
	function sort_entries_by_hierarchy(entries) {
		const entry_map = new Map(entries.map(entry => [entry.id, entry]))
		const sorted = []
		const visited = new Set()
		const temp_visited = new Set()
	
		function dfs(entry_id) {
			if (temp_visited.has(entry_id)) {
				throw new Error('Circular dependency detected in entries')
			}
			if (visited.has(entry_id)) return
	
			temp_visited.add(entry_id)
			const entry = entry_map.get(entry_id)
			
			if (entry.parent && entry_map.has(entry.parent)) {
				dfs(entry.parent)
			}
	
			temp_visited.delete(entry_id)
			visited.add(entry_id)
			sorted.push(entry)
		}
	
		for (const entry of entries) {
			if (!visited.has(entry.id)) {
				dfs(entry.id)
			}
		}
	
		return sorted
	}

}


async function build_site_bundle({ pages, symbols, site, page_types, sections }) {

	const page_files = await Promise.all(
		pages.map((page) => {
			return build_page_tree(page, 'en')
		})
	)

	// const symbol_files = await Promise.all(symbols.filter((s) => s.code.js).map((symbol) => build_symbol_tree(symbol)))
	const symbol_files = []

	return _.flattenDeep([...symbol_files, ...page_files.flat()])

	async function build_symbol_tree(symbol) {
		const data = get_content_with_synced_values({
			entries: symbol.entries,
			fields: symbol.fields,
			site,
			// page,
			pages,
			page_types
		})
		const res = await processCode({
			component: {
				html: symbol.code.html,
				css: symbol.code.css,
				js: symbol.code.js,
				data: data['en']
			}
		})

		if (res.error) {
			throw Error(`Error processing symbol: ${symbol.name}`)
		}
		const date = new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(new Date())
		return {
			path: '_symbols/' + symbol.id + '.js',
			content: `// ${symbol.name} - Updated ${date}\n\n` + res.js
		}
	}

	async function build_page_tree(page, language) {
		const { slug } = page
		const page_sections = sections.filter((s) => s.page === page.id)
		// const { data: sections } = await get(page_store).data.supabase.from('sections').select('*, entries(*), master(id, symbol, index)').match({ page: page.id })

		// order sections
		let ordered_sections = []

		// get mastered sections
		const mastered_sections = page_sections.filter((s) => s.master)

		for (const section of mastered_sections) {
			// if has symbol, add like normal
			if (section.master?.symbol) {
				ordered_sections.push({
					...section,
					index: section.master.index
				})
			}

			// if is master palette, insert palette sections, ordered by index
			if (!section.master?.symbol) {
				const palette_sections = page_sections.filter((s) => s.palette).sort((a, b) => a.index - b.index)
				palette_sections.index = section.master.index
				ordered_sections.push(palette_sections)
			}
		}

		ordered_sections = ordered_sections.sort((a, b) => a.index - b.index)
		ordered_sections = ordered_sections.flat()

		// then sort by index and flatten

		const page_type = page_types.find((pt) => pt.id === page.page_type)

		const { html } = await code_generators.page_html({
			site,
			page: {
				...page,
				page_type
			},
			page_sections: ordered_sections,
			// page_symbols: symbols.filter((symbol) => sections.find((section) => section.symbol === symbol.id)),
			page_symbols: symbols,
			page_list: pages,
			page_types,
			locale: language
		})

		let parent_urls = []
		const parent = pages.find((p) => p.id === page.parent)

		if (parent) {
			let no_more_parents = false
			let grandparent = parent
			parent_urls.push(parent.slug)
			while (!no_more_parents) {
				grandparent = pages.find((p) => p.id === grandparent.parent)
				if (!grandparent) {
					no_more_parents = true
				} else {
					parent_urls.unshift(grandparent.slug)
				}
			}
		}

		let path
		let full_url = slug
		if (slug === '') {
			path = `index.html`
		} else if (slug === '404') {
			path = `404.html`
		} else if (parent) {
			path = `${parent_urls.join('/')}/${slug}/index.html`
			full_url = `${parent_urls.join('/')}/${slug}`
		} else {
			path = `${slug}/index.html`
		}

		// add language prefix
		if (language !== 'en') {
			path = `${language}/${path}`
			full_url = `${language}/${full_url}`
		}

		const page_tree = [
			{
				path,
				content: html
			}
		]

		return page_tree
	}
}