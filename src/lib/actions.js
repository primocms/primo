import supabase from './supabase/core'
import { page } from '$app/stores'
import { get } from 'svelte/store'
import * as actions from '$lib/builder/actions/active_site'
import * as factories from '$lib/builder/factories'
import _ from 'lodash-es'
import axios from 'axios'
import scramble_ids from '../scramble_ids'
import * as helpers from '$lib/builder/actions/_helpers'
import * as db_utils from '$lib/builder/actions/_db_utils'
import * as code_generators from '$lib/builder/code_generators'
import { processCode } from '$lib/builder/utils'
import { get_content_with_synced_values } from '$lib/builder/stores/helpers'
import { v4 as uuidv4 } from 'uuid'
import {remap_entry_and_field_items} from '$lib/builder/actions/_db_utils'

/**
 * Deletes a site group from the database
 * @param {string} group_id - The ID of the site group to delete
 * @returns {Promise<void>}
 */
export async function delete_site_group(group_id) {
	await supabase.from('site_groups').delete().eq('id', group_id)
}

/**
 * Adds a site to a site group
 * @param {string} site_id - The ID of the site to add
 * @param {string} group_id - The ID of the group to add the site to
 * @returns {Promise<void>}
 */
export async function add_site_to_group(site_id, group_id) {
	await supabase.from('sites').update({ group: group_id }).eq('id', site_id)
}

/**
 * Removes a site from a site group
 * @param {string} site_id - The ID of the site to remove from its group
 * @returns {Promise<void>}
 */
export async function remove_site_from_group(site_id) {
	await supabase.from('sites').update({ group: null }).eq('id', site_id)
}

/**
 * Renames a site group
 * @param {string} group_id - The ID of the site group to rename
 * @param {string} new_name - The new name for the site group
 * @returns {Promise<void>}
 */
export async function rename_site_group(group_id, new_name) {
	await supabase.from('site_groups').update({ name: new_name }).eq('id', group_id)
}

/**
 * Creates a new site group
 * @param {string} name - The name of the site group to create
 * @returns {Promise<void>}
 */
export async function create_site_group(name) {
	await supabase.from('site_groups').insert({ name, owner: get(page).data.user.id })
}

/**
 * Moves a library symbol to a different group
 * @param {string} symbol_id - The ID of the library symbol to move
 * @param {string} new_group_id - The ID of the group to move the symbol to
 * @returns {Promise<void>}
 */
export async function move_library_symbol(symbol_id, new_group_id) {
	await supabase.from('library_symbols').update({ group: new_group_id }).eq('id', symbol_id)
}


/**
 * Deletes a library symbol group
 * @param {string} group_id - The ID of the library symbol group to delete
 * @returns {Promise<void>}
 */
export async function delete_library_symbol_group(group_id) {
	await supabase.from('library_symbol_groups').delete().eq('id', group_id)
}

/**
 * Renames a library symbol group
 * @param {string} group_id - The ID of the library symbol group to rename
 * @param {string} new_name - The new name for the library symbol group
 * @returns {Promise<void>}
 */
export async function rename_library_symbol_group(group_id, new_name) {
	await supabase.from('library_symbol_groups').update({ name: new_name }).eq('id', group_id)
}


/**
 * Creates a new library symbol group
 * @param {string} name - The name of the library symbol group to create
 * @returns {Promise<void>}
 */
export async function create_library_symbol_group(name) {
	await supabase.from('library_symbol_groups').insert({ name, owner: get(page).data.user.id })
}

/**
 * Adds a marketplace starter to the user's library
 * @param {Object} starter - The starter object containing name, code, entries, and fields
 * @param {string} starter.name - The name of the starter
 * @param {string} starter.code - The code for the starter
 * @param {Array<import('$lib').Entry>} starter.entries - The entries data for the starter
 * @param {Array<import('$lib').Field>} starter.fields - The fields data for the starter
 * @param {string} preview - The HTML preview content for the starter
 * @returns {Promise<void>}
 */
export async function add_marketplace_starter_to_library(starter, preview) {
	const new_starter_id = uuidv4()
	remap_entry_and_field_items({ entries: starter.entries, fields: starter.fields })

	const symbol_res = await supabase.from('library_symbols').insert({ id: new_starter_id, name: starter.name, code: starter.code, index: 0, owner: get(page).data.user.id })
	if (symbol_res.error) {
		console.log('Failed to insert site', { symbol_res, starter })
		throw new Error('Failed to insert site')
	}

	const fields_res = await supabase.from('fields').insert(starter.fields.map(f => ({ ...f, library_symbol: new_starter_id })))
	if (fields_res.error) {
		console.log('Failed to insert fields', { fields_res, fields: starter.fields })
		throw new Error('Failed to insert fields')
	}

	const entries_res = await supabase.from('entries').insert(starter.entries.map(f => ({ ...f, library_symbol: new_starter_id })))
	if (entries_res.error) {
		console.log('Failed to insert entries', { entries_res, entries: starter.entries })
		throw new Error('Failed to insert entries')
	}

	const storage_res = await supabase.storage.from('sites').upload(`${new_starter_id}/preview.html`, preview)
}

/**
 * Adds a marketplace symbol to the user's library
 * @param {Object} options - The options object
 * @param {Object} options.symbol - The symbol object containing name, code, entries, and fields
 * @param {string} options.symbol.name - The name of the symbol
 * @param {import('$lib').Code} options.symbol.code - The code for the symbol
 * @param {Array<import('$lib').Entry>} options.symbol.entries - The entries data for the symbol
 * @param {Array<import('$lib').Field>} options.symbol.fields - The fields data for the symbol
 * @param {string} options.preview - The HTML preview content for the symbol
 * @param {string} options.group_id - The ID of the library group to add the symbol to
 * @returns {Promise<void>}
 */
export async function add_marketplace_symbol_to_library({symbol, preview, group_id}) {
	const new_symbol_id = uuidv4()
	remap_entry_and_field_items({ entries: symbol.entries, fields: symbol.fields })

	const symbol_res = await supabase.from('library_symbols').insert({ id: new_symbol_id, name: symbol.name, code: symbol.code, index: 0, group: group_id, owner: get(page).data.user.id })
	if (symbol_res.error) {
		console.log('Failed to insert site', { symbol_res, symbol })
		throw new Error('Failed to insert site')
	}

	const fields_res = await supabase.from('fields').insert(symbol.fields.map(f => ({ ...f, library_symbol: new_symbol_id })))
	if (fields_res.error) {
		console.log('Failed to insert fields', { fields_res, fields: symbol.fields })
		throw new Error('Failed to insert fields')
	}

	const entries_res = await supabase.from('entries').insert(symbol.entries.map(f => ({ ...f, library_symbol: new_symbol_id })))
	if (entries_res.error) {
		console.log('Failed to insert entries', { entries_res, entries: symbol.entries })
		throw new Error('Failed to insert entries')
	}

	const storage_res = await supabase.storage.from('symbols').upload(`${new_symbol_id}/preview.html`, preview)
}

/**
 * Renames a library symbol
 * @param {string} id - The ID of the symbol to rename
 * @param {string} new_name - The new name for the symbol
 * @returns {Promise<void>}
 */
export async function rename_library_symbol(id, new_name) {
	await supabase.from('library_symbols').update({ name: new_name }).eq('id', id)
}

/**
 * Creates a new library symbol
 * @param {Object} options - The symbol creation options
 * @param {string} [options.name=''] - The name of the symbol
 * @param {Object} options.code - The symbol code (html, css, js)
 * @param {Object} options.content - The symbol's content
 * @param {Array<import('$lib').Entry>} options.content.entries - Array of entry objects
 * @param {Array<import('$lib').Field>} options.content.fields - Array of field objects
 * @param {string} options.preview - The preview HTML
 * @param {string} options.group - The group ID this symbol belongs to
 * @returns {Promise<void>}
 */
export async function create_library_symbol({ name = '', code, content, preview, group }) {
	const symbol_id = uuidv4()
	const changes = { 
		entries: db_utils.generate_entry_changes([], content.entries), 
		fields: db_utils.generate_field_changes([], content.fields) 
	}
	await Promise.all([
		(async() => {
			let library_symbols_res = await supabase.from('library_symbols').insert({ id: symbol_id, code, name: name, index: 0, group, owner: get(page).data.user.id }).select().single()
			if (library_symbols_res.error) {
				console.log('Failed to insert symbols', library_symbols_res)
				throw new Error('Failed to insert symbols')
			}
		
			// DB: save Symbol fields
			await helpers.handle_field_changes_new(changes.fields.map(f => ({ ...f, symbol: null })), {
				library_symbol: symbol_id
			})

			// DB: save Symbol entries
			await helpers.handle_content_changes_new(changes.entries.map(f => ({ ...f, symbol: null })), {
				library_symbol: symbol_id
			})
		})(),
		supabase.storage.from('symbols').upload(`${symbol_id}/preview.html`, preview)
	])
}

/**
 * Saves changes to an existing library symbol
 * @param {string} id - The ID of the symbol to update
 * @param {Object} options - The update options
 * @param {Object} options.code - The symbol code (html, css, js)
 * @param {Object} options.content - The symbol data with original and updated values
 * @param {Object} options.content.original - The original symbol content
 * @param {Array<import('$lib').Entry>} options.content.original.entries - Array of original entry objects
 * @param {Array<import('$lib').Field>} options.content.original.fields - Array of original field objects
 * @param {Object} options.content.updated - The updated symbol content
 * @param {Array<import('$lib').Entry>} options.content.updated.entries - Array of updated entry objects
 * @param {Array<import('$lib').Field>} options.content.updated.fields - Array of updated field objects
 * @param {string} options.preview - The preview HTML
 * @returns {Promise<void>}
 */
export async function save_library_symbol(id, { code, content, preview }) {

	const content_changes = db_utils.generate_entry_changes(content.original.entries, content.updated.entries)
	const field_changes = db_utils.generate_field_changes(content.original.fields, content.updated.fields)

	// DB: save block code if changed
	await supabase.from('library_symbols').update({ code }).eq('id', id)

	// DB: save Symbol fields
	await helpers.handle_field_changes_new(field_changes, {
		library_symbol: id
	})

	// DB: save Symbol entries
	await helpers.handle_content_changes_new(content_changes, {
		library_symbol: id
	})

	await supabase.storage.from('symbols').upload(`${id}/preview.html`, preview, { upsert: true })
}

/**
 * Deletes a library symbol from the database
 * @param {string} symbol_id - The ID of the symbol to delete
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails
 */
export async function delete_library_symbol(symbol_id) {
	const res = await supabase.from('library_symbols').delete().eq('id', symbol_id)
	if (res.error) {
		console.log('Failed to delete library symbol', res)
		throw new Error('Failed to delete library symbol')
	}
}

/**
 * Creates a new starter site
 * @param {Object} options - The starter options
 * @param {Object} options.details - Basic site details
 * @param {string} options.details.name - Name of the site
 * @param {string} options.details.description - Description of the site
 * @param {string} options.preview - Preview HTML content
 * @param {Object} [options.site_data] - Optional existing site data to use as template
 * @returns {Promise<void>}
 */
export async function create_starter({ details, preview, site_data = null }) {

	let starter_data
	if (site_data) {
		site_data.site.name = details.name
		site_data.site.description = details.description
		const scrambled = scramble_ids(site_data)
		starter_data = prepare_data(scrambled)
	} else {
		const site_id = uuidv4()
		const page_type_id = uuidv4()
		const home_page_id = uuidv4()
		const master_palette_id = uuidv4()
		const empty_starter = {
			site: {
				id: site_id,
				name: details.name,
				code: {
					head: '',
					foot: ''
				},
				design: {
						heading_font: 'Open Sans',
						body_font: 'Open Sans',
						primary_color: '#864040',
						radius: '0px',
						shadow: "0.3px 0.5px 0.7px hsl(0deg 36% 56% / 0.34),0.4px 0.8px 1px -1.2px hsl(0deg 36% 56% / 0.34), 1px 2px 2.5px -2.5px hsl(0deg 36% 56% / 0.34)",
				},
				entries: [],
				fields: []
			},
			pages: [
				factories.Page({
					id: home_page_id,
					index: 0,
					name: "Home Page",
					page_type: page_type_id,
					owner_site: site_id
				})
			],
			page_types: [
				factories.Page_Type({
					id: page_type_id,
					name: "Default",
					owner_site: site_id
				})
			],
			sections: [
				factories.Section({
					id: master_palette_id,
					page_type: page_type_id,
					owner_site: site_id
				}),
				factories.Section({
					page: home_page_id,
					master: master_palette_id,
					owner_site: site_id
				})
			],
			symbols: []
		}
		starter_data = prepare_data(empty_starter)
	}

	const { site, page_types, pages, symbols, sections, entries, fields } = starter_data

	site.is_starter = true

	try {
		// Step 1: Insert starter
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
		await supabase.storage.from('sites').upload(`${site.id}/preview.html`, preview)

		console.log('Site created successfully')
	} catch (e) {
		console.error('SOMETHING WENT WRONG', e)
			// TODO: Implement rollback logic to delete inserted items if an error occurs
	}
}

export const sites = {
	create: async ({ starter_id, duplication_source, details, preview, group }) => {

		const uploaded_data = starter_id ? await fetch_site_data(starter_id) : duplication_source
		uploaded_data.site.name = details.name
		uploaded_data.site.design = _.cloneDeep(details.design)

		const scrambled = scramble_ids(uploaded_data)
		const files = await build_site_bundle(scrambled)
		const prepared_data = prepare_data(scrambled)

		const { site, page_types, pages, symbols, sections, entries, fields } = prepared_data

		try {
			// Step 1: Insert site
			let res = await supabase.from('sites').insert({ ...site, group, owner: get(page).data.user.id })
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

			console.log('Site created successfully')
		} catch (e) {
			console.error('SOMETHING WENT WRONG', e)
				// TODO: Implement rollback logic to delete inserted items if an error occurs
		}
	},
	update: async (site_id, props) => {
		await supabase.from('sites').update(props).eq('id', site_id)
	},
	move: async (site_id, new_group_id) => {
		await supabase.from('sites').update({ group: new_group_id }).eq('id', site_id)
	},
	delete: async (site_id, delete_deployment = false) => {
		await supabase.from('sites').delete().eq('id', site_id)
		if (delete_deployment) {
			await axios.delete(`/api/deploy/delete-deployment?site_id=${site_id}`)
		}
	},
	deploy: async (site_id, custom_domain = null) => {

		const site_data = await fetch_site_data(site_id)

		// const scrambled = scramble_ids(site_data)
		const files = await build_site_bundle(site_data)
		const prepared_data = prepare_data(site_data)

		const { site } = prepared_data

		try {
			// create distribution
			const dist_res = await axios.post('/api/deploy/initial-deployment', {files, site_id: site.id, domain_name: site.domain_name})

			console.log('Site created successfully')
		} catch (e) {
			console.error('SOMETHING WENT WRONG', e)
				// TODO: Implement rollback logic to delete inserted items if an error occurs
		}
	}
}

export async function fetch_site_data(site_id) {
	const { data, error } = await supabase
	.from('sites')
	.select(`
		id,
		name,
		code,
		design,
		fields!fields_site_fkey(*),
		entries!entries_site_fkey(*),
		page_types(
			*,
			fields(*),
			entries(*),
			sections(*, entries(*)),
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

	if (!data) {
		throw new Error('Could not find site')
	}

	const site_data = {
		site: _.omit(data, ['pages', 'page_types', 'symbols', 'sections']),
		pages: data.page_types.flatMap(pt => pt.pages.map(p => _.omit(p, ['sections']))), 
		page_types: data.page_types.map(pt => _.omit(pt, ['pages', 'sections'])),
		symbols: data.symbols,
		sections: data.page_types.flatMap(pt => [ ...pt.sections, ...pt.pages.flatMap(p => p.sections)])
	}

	return site_data
}

function prepare_data(data) {

	// Prepare data while maintaining relationships
	const site = _.omit(data.site, ['entries', 'fields'])
	const page_types = data.page_types.map((pt) => _.omit(pt, ['sections', 'entries', 'fields']))
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
		page_types: page_types.map(pt => ({ ...pt, owner_site: site.id })),
		pages: sort_pages_by_hierarchy(pages).map(page => ({ ...page, owner_site: site.id })),
		sections: sort_sections_by_hierarchy(sections).map(s => ({ ...s, owner_site: site.id })),
		symbols: symbols.map(s => ({ ...s, owner_site: site.id })),
		fields: sorted_fields.map(f => ({ ...f, owner_site: site.id })),
		entries: sorted_entries.map(e => ({ ...e, owner_site: site.id }))
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
		pages.map((page) => build_page_tree(page))
	)

	const symbol_files = await Promise.all(symbols.filter((s) => s.code.js).map((symbol) => build_symbol_tree(symbol)))

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

	async function build_page_tree(page) {
		const page_type = page_types.find((pt) => pt.id === page.page_type)
		const page_sections = sections.filter((s) => s.page === page.id)

		function get_full_path(page, path = page?.slug || '') {
			const parent = pages.find(p => p.id === page.parent)
			if (!parent) return path
			
			return get_full_path(parent, parent.slug + '/' + path)
		}
	
		// order sections
		let ordered_sections = []
	
		// get mastered sections
		const mastered_sections = page_sections.filter((s) => s.master).map(section => {
			const section_master = sections.find(s => s.id === section.master)
			return {
				...section,
				master: section_master
			}
		})
	
		// @ts-ignore
		for (const section of mastered_sections.sort((a, b) => a.master.index - b.master.index)) {
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
				ordered_sections.push(...palette_sections)
			}
		}

		// then sort by index and flatten
		const { html } = await code_generators.page_html({
			site,
			page: {
				...page,
				page_type
			},
			page_sections: ordered_sections,
			page_symbols: symbols,
			page_list: pages,
			page_types
		})
	
		let path
		if (page.slug === '') {
			path = `index.html`
		} else {
			path = `${get_full_path(page)}/index.html`
		}

		return {
			path,
			content: html
		}
	}

}

