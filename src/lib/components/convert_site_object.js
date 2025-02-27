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
	const fields = build_fields({ symbols, site })
	const entries = build_content({ sections, symbols, site }, fields)
	// const {fields, entries} = build_fields_and_entries(symbols, site, sections) // in progress

	return {
		site: {
			...build_site(site),
			entries: entries.filter((entries) => entries.site === site.id),
			fields: fields.filter((field) => field.site === site.id)
		},
		page_types: [standard_page_type],
		pages: build_pages(pages, standard_page_type.id).map((page) => ({
			...page,
			entries: entries.filter((entry) => entry.page === page.id)
		})),
		symbols: build_symbols(symbols, site.id, standard_page_type.id).map((symbol) => ({
			...symbol,
			entries: entries.filter((entry) => entry.symbol === symbol.id),
			fields: fields.filter((field) => field.symbol === symbol.id)
		})),
		sections: build_sections(pages, sections, standard_page_type.id).map((section) => ({
			...section,
			entries: entries.filter((entry) => entry.section === section.id)
		}))
	}
}

/** @returns {Array<import('$lib').Entry>} */
function build_content({ sections, symbols, site }, fields) {
	const section_content = sections.flatMap((section) => {
		const symbol = symbols.find((symbol) => symbol.id === section.symbol)
		if (!symbol) return []

		// convert static field to normal field, copy content from symbol into section
		const symbol_content = symbol.content
		const symbol_fields = fields.filter((f) => f.symbol === symbol.id)
		const combined_content = { ...symbol_content.en, ...section.content.en }
		return flatten_content({ content: { en: combined_content }, all_fields: symbol_fields, args: { section: section.id } })
	})

	const symbol_content = symbols.flatMap((symbol) => {
		const symbol_fields = fields.filter((f) => f.symbol === symbol.id).filter((f) => !f.source)
		return flatten_content({ content: symbol.content, all_fields: symbol_fields, args: { symbol: symbol.id } })
	})

	const site_fields = fields.filter((f) => f.site === site.id)
	const site_content = flatten_content({ content: site.content, all_fields: site_fields, args: { site: site.id } })
	return [...section_content, ...symbol_content, ...site_content]
}

/** @returns {Array<import('$lib').Field>} */
function build_fields({ symbols, site }) {
	const symbol_fields = []
	const site_fields = []

	for (const symbol of symbols) {
		symbol.fields.forEach((field, index) => {
			const converted_field = factories.Field(field)
			symbol_fields.push({ ...converted_field, index, symbol: symbol.id })
			symbol_fields.push(...flatten_fields({ fields: field.fields, parent_id: converted_field.id, args: { symbol: symbol.id } }))
		})
	}

	site.fields.forEach((field, index) => {
		const converted_field = factories.Field(field)
		site_fields.push({ ...converted_field, index, site: site.id })
		site_fields.push(...flatten_fields({ fields: field.fields, args: { site: site.id } }))
	})

	return [...symbol_fields, ...site_fields]
}


/** @returns {Array<import('$lib').Section>} */
function build_sections(pages, sections, standard_page_type_id) {
	// add palette section for each page (w/ master as pallete master)
	// attach page sections to palette section

	const standard_palette = _.omit(factories.Section({ page_type: standard_page_type_id }), ['created_at', 'entries'])
	const palette_sections = pages.map((page) => _.omit(factories.Section({ page: page.id, master: standard_palette.id }), ['created_at', 'entries']))

	return [
		standard_palette,
		...palette_sections,
		...sections.map((s) => {
			const palette = palette_sections.find((ps) => ps.page === s.page)
			return {
				id: s.id,
				index: s.index,
				symbol: s.symbol,
				page: s.page,
				page_type: null,
				master: null,
				palette: palette.id
			}
		})
	]
}

/** @returns {Array<import('$lib').Symbol>} */
function build_symbols(symbols, site_id, standard_page_type_id) {
	return symbols.map((s, i) => factories.Symbol({
		...s,
		site: site_id,
		index: s.index || i,
		page_types: [standard_page_type_id]
	}))
}

/** @returns {Array<import('$lib').Page>} */
function build_pages(pages, page_master_id) {
	return pages.map((p, i) => ({
		id: p.id,
		name: p.name,
		slug: p.url === 'index' ? '' : _.last(_.split(p.url, '/')), // get 'team' from 'about/company/team'
		parent: p.parent,
		page_type: page_master_id,
		index: i
	}))
}

/** @returns {import('$lib').Page_Type} */
function build_standard_page_type(site) {
	return {
		id: uuidv4(),
		name: 'Default',
		code: Enclosing_Code(),
		owner_site: site.id,
		color: '#222',
		icon: 'iconoir:page',
		index: 0,
		entries: [],
		fields: []
	}
}

/** @returns {import('$lib').Site} */
function build_site(site) {
	return Site({
		id: site.id,
		name: site.name,
		code: Enclosing_Code(site.code),
		// design: site.design,
		// custom_domain: site.custom_domain
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

function flatten_fields({ fields, parent_id = null, result = [], args = {} }) {
	fields.forEach((field, i) => {
		// Add the parent key to each field
		const new_field = { ...factories.Field({ ...field, index: i }), ...args, id: field.id, parent: parent_id }
		result.push(new_field)

		if (field.default) {
			console.log('DEFAULT', field, new_field)
		}

		// If this field has nested fields, recursively flatten them
		if (field.fields.length > 0) {
			flatten_fields({ fields: field.fields, parent_id: field.id, result, args })
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
export function flatten_content({ content, all_fields, args = {} }) {
	const flattened = []

	function create_row({ value, locale, field, index = null, parent = null, args = {} }) {
		const row_id = uuidv4()
		flattened.push({
			id: row_id,
			value,
			locale,
			field,
			index,
			parent,
			...args
		})
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
				const id = create_row({
					value: null,
					locale: null,
					field: field.id,
					parent,
					args
				})
				// recurse({ content_value: item, locale, fields: field.fields, parent: id })
				recurse({ content_value: item, locale, fields: all_fields.filter((f) => f.parent === field.id), parent: id })
			} else if (field.type === 'repeater') {
				// add repeater container (only tracks field)
				const container_id = create_row({
					value: null,
					locale: null,
					field: field.id,
					parent,
					args
				})
				// add repeater items (only track index)
				item.forEach((value, i) => {
					const item_id = create_row({
						value: null,
						field: null,
						locale: null,
						index: i,
						parent: container_id,
						args
					})
					// attach subfield values to repeater item
					recurse({ content_value: value, locale, fields: all_fields.filter((f) => f.parent === field.id), parent: item_id })
					// recurse({ content_value: value, locale, fields: field.fields, parent: item_id })
				})
			} else {
				// add value item (no index)
				create_row({
					value: item,
					field: field.id,
					locale,
					parent,
					args
				})
			}
		})
	}

	// Start processing for each locale
	Object.keys(content).forEach((locale) => {
		// ensure uncorrupted data
		if (constants.locales.find((loc) => loc.key === locale)) {
			recurse({ content_value: content[locale], locale, fields: all_fields })
		}
	})

	return flattened
}
