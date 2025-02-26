import { find as _find, chain as _chain, flattenDeep as _flattenDeep } from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import { v4 as uuidv4 } from 'uuid'
import stores from '$lib/builder/stores/data'
import { site as activeSite } from './data/site.js'
import sections from './data/sections.js'
import symbols from './data/symbols.js'
// import page_types from './data/page_types.js'
import { page } from '$app/stores'
import active_page from './data/page.js'
import page_type from './data/page_type.js'
import { locale } from './app/misc.js'
import { transform_content } from '../transform_data.js'

export async function get_symbol_usage_info(symbol_id) {
	const { data, error } = await get(page).data.supabase.from('sections').select('page(*)').eq('symbol', symbol_id)
	if (data.length === 0) {
		return 'Not used on any pages'
	} else {
		const info = data.reduce(
			(previous, current) => {
				if (previous.pages.includes(current.page.name)) {
					return previous
				} else {
					return {
						n_pages: previous.n_pages + 1,
						pages: [...previous.pages, current.page.name]
					}
				}
			},
			{ n_pages: 0, pages: [] }
		)
		if (info.n_page === 1) {
			return `Used on ${info.pages[0]}`
		} else {
			return `Used on ${info.n_pages} page${info.n_pages === 1 ? '' : 's'}: ${info.pages.join(', ')}`
		}
	}

	// return info
}

export function get_symbol(symbol_id) {
	const symbol = get(symbols).find((s) => s.id === symbol_id)
	if (!symbol) {
		throw Error(`Could not find symbol ${symbol_id}`)
	}
	return symbol
}

export function get_section(section_id) {
	const section = get(sections).find((s) => s.id === section_id)
	if (!section) {
		throw Error(`Could not find section ${section_id}`)
	}
	return section
}

export function get_on_page_symbol_sections(symbol_id) {
	return get(sections).filter((s) => s.symbol === symbol_id || s.master?.symbol === symbol_id)
}

// Build content tree and fetch synced values
export function get_content_with_synced_values({ entries, fields, page = get(active_page), site = get(activeSite), pages = get(stores.pages), page_types = get(stores.page_types) }) {
	const site_data_field_types = ['page-field', 'site-field', 'page', 'page-list']

	function get_page_content(field, entry) {
		const page_content = []

		// create temporary group field for page fields
		const temp_group_field = {
			id: uuidv4(),
			type: 'group',
			key: field.key,
			parent: field.parent
		}
		fields_with_source.push(temp_group_field)

		// create temporary group field for _meta and child fields
		const meta_keys = ['name', 'created_at', 'slug']
		const temp_meta_group_field = {
			id: uuidv4(),
			type: 'group',
			key: '_meta',
			parent: temp_group_field.id
		}
		fields_with_source.push(temp_meta_group_field)

		const temp_meta_group_subfields = [
			...meta_keys.map((key) => ({
				id: uuidv4(),
				type: 'text',
				key,
				parent: temp_meta_group_field.id
			})),
			{
				id: uuidv4(),
				type: 'url',
				key: 'url',
				parent: temp_meta_group_field.id
			}
		]
		fields_with_source.push(...temp_meta_group_subfields)

		// get fields from selected page type
		const { page_type: selected_page_type_id } = pages.find((p) => p.page_type === field.options.page_type)
		const selected_page_type = page_types.find(pt => pt.id === selected_page_type_id)

		const page_type_fields = selected_page_type.fields
		fields_with_source.push(...page_type_fields)

		// get entries from selected page
		const selected_page = pages.find((p) => p.id === entry.value)

		// create group container entry for page fields
		const group_container_entry = {
			id: uuidv4(),
			field: temp_group_field.id,
			parent: null // TODO: assign parent entry so this works as a subfield? or just disable
		}
		page_content.push(group_container_entry)

		const content_with_group_parent = selected_page.entries.map((entry) => ({
			...entry,
			parent: entry.parent || group_container_entry.id
		}))
		page_content.push(...content_with_group_parent)

		// create temporary group container entry for _meta
		const meta_group_container_entry = {
			id: uuidv4(),
			field: temp_meta_group_field.id,
			parent: group_container_entry.id
		}
		page_content.push(meta_group_container_entry)

		function build_url(page, all_pages) {
			if (!page) return ''

			const parent = all_pages.find((p) => p.id === page.parent)
			return build_url(parent, all_pages) + `/${page.slug}`
		}

		// create _meta group entries
		const meta_content = [
			...Object.entries(selected_page)
				.filter((item) => meta_keys.includes(item[0]))
				.map(([key, value]) => ({
					id: uuidv4(),
					value,
					field: temp_meta_group_subfields.find((f) => f.key === key).id,
					locale: 'en',
					parent: meta_group_container_entry.id
				})),
			{
				id: uuidv4(),
				value: build_url(selected_page, pages),
				field: temp_meta_group_subfields.find((f) => f.key === 'url').id,
				locale: 'en',
				parent: meta_group_container_entry.id
			}
		]
		page_content.push(...meta_content)

		return page_content
	}

	const loc = 'en'

	let content_tree = {}

	// first, remove data fields and entries to add in later
	const fields_with_source = _.cloneDeep(fields.filter((f) => !site_data_field_types.includes(f.type)))
	const content_with_source = _.cloneDeep(
		entries.filter((entry) => {
			const parent_entry = entries.find((e) => e.id === entry.parent)
			const field = fields.find((f) => {
				return f.id === entry.field || f.id === parent_entry?.field
			})
			return !field || !site_data_field_types.includes(field.type)
		})
	)
	try {
		const ordered_data_fields = fields.filter((f) => site_data_field_types.includes(f.type)).sort((a, b) => a.index - b.index)

		for (const field of ordered_data_fields) {
			if (field.type === 'page-field') {
				const page_content = page?.entries
				const page_type_content = get(page_type)?.entries
				const source_content = page_content?.some((e) => e.field === field.source) ? page_content : page_type_content

				const page_type_fields = get(page_type)?.fields
				const source_fields = page_type_fields?.some((f) => f.id === field.source) ? page_type_fields : page.page_type.fields

				// get data from source
				const source_field = source_fields.find((f) => f.id === field.source)
				const source_entry = source_content.find((e) => e.field === field.source)

				if (!source_field) {
					console.warn('Source field has been deleted', field)
					// fields_with_source.push(field) // maintain original key
					// content_with_source.push(source_entry)
					continue
				}

				// add this field
				fields_with_source.push({ ...source_field, key: field.key }) // maintain original key
				content_with_source.push(source_entry)

				if (source_field.type === 'page') {
					const page_entries = get_page_content(source_field, source_entry)
					content_with_source.push(...page_entries)
					continue
				}

				if (source_field.type === 'repeater' || source_field.type === 'group') {
					// push repeater item entries
					for (const entry of source_content) {
						const is_descendent = get_ancestors(entry, source_content).includes(source_entry.id)
						if (is_descendent) content_with_source.push(entry)
					}
					for (const field of source_fields) {
						const is_descendent = get_ancestors(field, source_fields).includes(source_field.id)
						if (is_descendent) fields_with_source.push(field)
					}
				}

				continue
			}

			if (field.type === 'site-field') {
				const site_content = site.entries
				const site_fields = site.fields

				// get data from source
				const source_entry = site_content.find((e) => e.field === field.source)
				const source_field = site_fields.find((f) => f.id === field.source)

				// field's been deleted, ignore it
				if (!source_field) continue

				// add this field
				fields_with_source.push({ ...source_field, key: field.key }) // maintain original key
				content_with_source.push(source_entry)

				if (source_field.type === 'repeater' || source_field.type === 'group') {
					// push repeater item entries
					for (const entry of site_content) {
						const is_descendent = get_ancestors(entry, site_content).includes(source_entry.id)
						if (is_descendent) content_with_source.push(entry)
					}
					for (const field of site_fields) {
						const is_descendent = get_ancestors(field, site_fields).includes(source_field.id)
						if (is_descendent) fields_with_source.push(field)
					}
				}

				continue
			}

			if (field.type === 'page') {
				const entry = entries.find((e) => e.field === field.id)
				const page_entries = get_page_content(field, entry)
				content_with_source.push(...page_entries)
				continue
			}

			if (field.type === 'page-list') {
				// create temporary repeater field for pages array
				const temp_repeater_field = { id: uuidv4(), type: 'repeater', key: field.key }
				fields_with_source.push(temp_repeater_field)

				// create temporary group field for _meta and child fields
				const meta_keys = ['name', 'created_at', 'slug']
				const temp_group_field = {
					id: uuidv4(),
					type: 'group',
					key: '_meta',
					parent: temp_repeater_field.id
				}
				fields_with_source.push(temp_group_field)

				const temp_group_subfields = [
					...meta_keys.map((key) => ({
						id: uuidv4(),
						type: 'text',
						key,
						parent: temp_group_field.id
					})),
					{
						id: uuidv4(),
						type: 'url',
						key: 'url',
						parent: temp_group_field.id
					}
				]
				fields_with_source.push(...temp_group_subfields)

				// get fields from selected page type
				// const selected_page_type_id = pages.find((p) => p.page_type === field.options?.page_type)?.page_type
				const selected_page_type = page_types.find(pt => pt.id === field.options?.page_type)

				if (!selected_page_type) {
					continue;
				}

				const page_type_fields = selected_page_type.fields.map((f) => ({
					...f,
					parent: f.parent || selected_page_type.id
				}))

				// create temporary repeater container entry
				const repeater_container_entry = { id: uuidv4(), field: temp_repeater_field.id }
				content_with_source.push(repeater_container_entry)

				// get entries from all pages of selected page type
				let current_index = 0
				const pages_content = pages.reduce((agg, page) => {
					if (page.page_type === selected_page_type.id) {
						const repeater_item_entry = {
							id: uuidv4(),
							parent: repeater_container_entry.id,
							index: current_index
						}
						const content_with_repeater_item_parent = page.entries.map((entry) => ({
							...entry,
							parent: entry.parent || repeater_item_entry.id
						}))

						// create temporary group container entry for _meta
						const group_container_entry = {
							id: uuidv4(),
							field: temp_group_field.id,
							parent: repeater_item_entry.id
						}

						function build_url(page, all_pages) {
							if (!page) return ''

							const parent = all_pages.find((p) => p.id === page.parent)
							return build_url(parent, all_pages) + `/${page.slug}`
						}

						// create _meta group entries
						const meta_content = [
							...Object.entries(page)
								.filter((item) => meta_keys.includes(item[0]))
								.map(([key, value]) => ({
									id: uuidv4(),
									value,
									field: temp_group_subfields.find((f) => f.key === key).id,
									locale: 'en',
									parent: group_container_entry.id
								})),
							{
								id: uuidv4(),
								value: build_url(page, pages),
								field: temp_group_subfields.find((f) => f.key === 'url').id,
								locale: 'en',
								parent: group_container_entry.id
							}
						]

						current_index++
						return agg.concat(repeater_item_entry, ...content_with_repeater_item_parent, group_container_entry, ...meta_content)
					}
					return agg
				}, [])

				fields_with_source.push(...page_type_fields)
				content_with_source.push(...pages_content)
				continue
			}
		}

		content_tree = transform_content({
			fields: fields_with_source,
			entries: content_with_source
		})
	} catch (e) {
		console.log('could not load new component entries', e)
	}

	// TODO: handle other locales
	return _.cloneDeep(content_tree)
}

function get_ancestors(entry, entities) {
	const parent = entities.find((e) => e.id === entry.parent)
	return parent ? [parent.id, ...get_ancestors(parent, entities)] : []
}

export function get_page_data({ page = get(active_page), page_type = get(stores.page_type), site = get(activeSite), loc = get(locale) }) {
	const page_content = transform_content({
		fields: page_type.fields,
		entries: page.entries
	})
	const site_content = transform_content({ fields: site.fields, entries: site.entries })

	return _.cloneDeep({
		...site_content[loc],
		...page_content[loc]
	})
}

export function get_site_data({ site = get(activeSite), loc = get(locale) }) {
	const site_content = transform_content({ fields: site.fields, entries: site.entries })

	return _.cloneDeep(site_content[loc])
}

export function get_page_fields() {
	return [ ...get(active_page).page_type.fields, ...get(page_type).fields ]
}