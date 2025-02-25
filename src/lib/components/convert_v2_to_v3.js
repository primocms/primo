import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash-es'
import * as factories from '$lib/builder/factories'
import * as constants from '$lib/builder/constants'
import { Field_Row, Page, Page_Type, Site, Symbol, Section, Content_Row, Field } from '$lib/builder/factories'

/** @returns {import('$lib').Site_Data} */
export default function convert_v2_to_v3({ sections, symbols, pages, site }) {
	// TODO for v2->v3 duplication/conversion
	// handle static fields -> duplicate as site field, attach to symbol field
	// organize indeces
	// on creation, connect id's to page types and pages
	// then: build page fields/content into standard page type 'head-embed' as static content

	// TODO for v3 -> v3 duplication
	// check for v3, return with updated id's
	// update primo.json builder to save v3

	const standard_page_type = build_standard_page_type(site)

	const extracted_fields = extract_static_fields(symbols, site)
	console.log({extracted_fields})

	return {
		site: build_site(site, extracted_fields.site),
		page_types: [standard_page_type],
		pages: build_pages(pages, standard_page_type.id),
		symbols: build_symbols(symbols, site.id, standard_page_type.id, extracted_fields.symbol),
		sections: build_sections({pages, sections, symbols, standard_page_type_id: standard_page_type.id}),
		// fields: fields_with_static_converted_to_site
	}
}

/** @returns {{ site: { fields: Array<import('$lib').Field>, entries: Array<import('$lib').Entry>}, symbol: { fields: Array<import('$lib').Field>, entries: Array<import('$lib').Entry>}}} */
function extract_static_fields(symbols, site) {
	const site_fields = []
	const site_entries = []
	
	const symbol_fields = []
	const symbol_entries = []

	for (const symbol of symbols) {
		// const symbol_fields = flatten_fields(symbol.fields.filter(s => s.is_static))
		const all_entries = flatten_content(symbol.content, symbol.fields)
		for (const field of symbol.fields.filter(s => s.is_static)) {

			// move symbol field to site
			const root_site_field = { ...Field({ ...field, type: field.type, site: site.id }), id: field.id }
			const child_site_fields = flatten_fields(field.fields, root_site_field.id)
			site_fields.push(root_site_field, ...child_site_fields)

			// move symbol entries to field
			const root_entry = all_entries.find(e => e.field === root_site_field.id)
			const child_entries = all_entries.filter(entry => {
				const belongs_to_field = child_site_fields.some(f => f.id === entry.field) || entry.parent === root_entry.id // repeater containers
				return belongs_to_field 
			})
			site_entries.push(root_entry, ...child_entries)

			// create symbol 'site-field' field
			const symbol_field = Field({ ...field, symbol: symbol.id, type: 'site-field', source: root_site_field.id })
			symbol_fields.push(symbol_field)

			// create symbol 'site-field' entry
			const symbol_entry = Content_Row({ field: symbol_field.id })
			symbol_entries.push(symbol_entry)
		}
	}

	return {
		site: {
			fields: site_fields,
			entries: site_entries
		},
		symbol: {
			fields: symbol_fields,
			entries: symbol_entries
		}
	}
}

/** @returns {Array<import('$lib').Section>} */
function build_sections({pages, sections, symbols, standard_page_type_id}) {
	// add palette section for each page (w/ master as pallete master)
	// attach page sections to palette section

	const standard_palette = _.omit(factories.Section({ page_type: standard_page_type_id }), ['created_at', 'entries'])
	const palette_sections = pages.map((page) => _.omit(factories.Section({ page: page.id, master: standard_palette.id }), ['created_at', 'entries']))

	console.log({ standard_palette, palette_sections })
	return [
		standard_palette,
		...palette_sections,
		...sections.map((s) => {
			const palette = palette_sections.find((ps) => ps.page === s.page)
			if (!palette) {
				debugger
			}
			const symbol = symbols.find(symbol => symbol.id === s.symbol)
			return Section({
				id: s.id,
				index: s.index,
				symbol: s.symbol,
				page: s.page,
				page_type: null,
				master: null,
				palette: palette.id,
				entries: flatten_content(s.content, symbol.fields)
			})
		})
	]
}

/** @returns {Array<import('$lib').Symbol>} */
function build_symbols(symbols, site_id, standard_page_type_id, extracted) {
	return symbols.map((s, i) => {
		const non_static_fields = s.fields.filter(field => !field.is_static)
		return ({
			id: s.id,
			name: s.name,
			code: s.code,
			site: site_id,
			index: s.index || i,
			page_types: [standard_page_type_id],
			entries: [...flatten_content(s.content, s.fields), ...extracted.entries],
			fields: [...flatten_fields(non_static_fields), ...extracted.fields]
		})
	})
}

/** @returns {Array<import('$lib').Page>} */
function build_pages(pages, page_master_id) {
	return pages.map((p, i) => Page({
		id: p.id,
		name: p.name,
		slug: p.url === 'index' ? '' : _.last(_.split(p.url, '/')), // get 'team' from 'about/company/team'
		parent: p.parent,
		page_type: page_master_id,
		index: i,
		entries: flatten_content(p.content, p.fields)
	}))
}

/** @returns {import('$lib').Field} */
function build_head_embed_field(page_master_id) {
	return {
		id: uuidv4(),
		key: 'head-embed',
		label: 'Head Embed',
		type: 'text',
		options: {},
		is_static: false,
		index: 10,
		parent: null,
		page_type: page_master_id
	}
}

/** @returns {import('$lib').Page_Type} */
function build_standard_page_type(site) {
	return Page_Type({
		name: 'Default',
		code: Enclosing_Code(),
		site: site.id,
		color: '#222',
		icon: 'iconoir:page',
		index: 0
	})
}

/** @returns {import('$lib').Site} */
function build_site(site, extracted) {
	return Site({
		id: site.id,
		name: site.name,
		code: Enclosing_Code(site.code),
		// entries: flatten_content(site.content, site.fields),
		// fields: flatten_fields(site.fields)
		entries: extracted.entries,
		fields: extracted.fields
	})
}

/////////////////////

function Enclosing_Code(code = { html: { head: '', below: '' }, css: '' }) {
	return {
		head: code.html.head + '\n\n' + `<style>\n${code.css}\n</style>`,
		foot: code.html.below
	}
}

// Utilities ///////////////

function flatten_fields(fields, parent_id = null, result = []) {
	fields.forEach((field, i) => {
		// Add the parent key to each field
		const new_field = { ...factories.Field({ ...field, index: i }), id: field.id, parent: parent_id }
		result.push(new_field)

		if (field.default) {
			console.log('DEFAULT', field, new_field)
		}

		// If this field has nested fields, recursively flatten them
		if (field.fields.length > 0) {
			flatten_fields(field.fields, field.id, result)
		}
	})
	return result
}

// DONE
// convert page/site code from { html: { head, below }, css, js } to { head, foot }
// remove page code/fields/content (maybe later add it to the standard page type)
// convert page 'url' to 'slug' & 'index' to ''
// add default page type, set to pages

// * @param {Object}
// * @param {object} [options.content] -
// * @param {Array<import('$lib').Field>} [options.fields] -
// * @param {boolean} [options.args=object] -
// * @returns {Array<import('$lib').Content>}
export function flatten_content(content, fields) {
	// console.log({content, fields})
	const flattened = []

	function create_entry({ value, locale, field, index = null, parent = null, args = {} }) {
		const row_id = uuidv4()
		const new_entry = Content_Row({
			id: row_id,
			value,
			locale,
			field,
			index,
			parent,
			...args
		})
		flattened.push(new_entry)
		return row_id
	}

	// Recursive function to process content
	function recurse({ content_value, fields, locale, parent = null }) {
		Object.keys(content_value).forEach((field_key) => {
			const item = content_value[field_key]
			// debugger
			const field = fields.find((f) => f.key === field_key)

			// Skip if no corresponding field is found (orphaned content)
			if (!field) {
				console.log('NO FIELD FOUND', { content_value, item, field_key, fields })
				return
			}

			if (field.type === 'group') {
				// add group container (no value or locale)
				const id = create_entry({
					value: null,
					locale: null,
					field: field.id,
					parent
				})
				// recurse({ content_value: item, locale, fields: field.fields, parent: id })
				recurse({ content_value: item, locale, fields: field.fields, parent: id })
			} else if (field.type === 'repeater') {
				// add repeater container (only tracks field)
				const container_id = create_entry({
					value: null,
					locale: null,
					field: field.id,
					parent
				})
				// add repeater items (only track index)
				item.forEach((value, i) => {
					const item_id = create_entry({
						value: null,
						field: null,
						locale: null,
						index: i,
						parent: container_id
					})
					// attach subfield values to repeater item
					recurse({ content_value: value, locale, fields: field.fields, parent: item_id })
					// recurse({ content_value: value, locale, fields: field.fields, parent: item_id })
				})
			} else {
				// add value item (no index)
				create_entry({
					value: item,
					field: field.id,
					locale,
					parent
				})
			}
		})
	}

	// Start processing for each locale
	Object.keys(content).forEach((locale) => {
		// ensure uncorrupted data
		if (constants.locales.find((loc) => loc.key === locale)) {
			console.log({content, locale, fields})
			recurse({ content_value: content[locale], locale, fields })
		}
	})

	return flattened
}
