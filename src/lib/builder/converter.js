import _ from 'lodash-es'
import { v4 as uuidv4 } from 'uuid'
import { createUniqueID } from './utilities.js'
import { get_empty_value } from './utils.js'
import { Field, Page, Site, Symbol } from './factories'
import * as constants from './constants.js'

const NewField = (field) => {
	if (field.type === 'content') {
		field.type = 'markdown'
	}
	delete field.default
	return {
		...Field(field),
		fields: field.fields.map(Field)
	}
}

/** @returns {import('$lib').Site_Data} */
export function validate_site_structure_v2(data) {
	// current site version -> replace IDs & return
	if (data.version === 2) {
		const standard_page_type = build_standard_page_type(data.site)
		return {
			...data,
			site: Site({
				...data.site,
				code: Enclosing_Code(data.site.code),
				fields: validate_fields(data.site.fields)
			}),
			pages: data.pages.map((page) => ({
				fields: validate_fields(page.fields),
				...Page({
					...page,
					slug: page.url === 'index' ? '' : page.url,
					page_type: standard_page_type.id
				}),
				id: page.id
			})),
			page_types: [standard_page_type],
			symbols: data.symbols.map((s) => ({
				...s,
				fields: validate_fields(s.fields)
			})),
			sections: data.sections
			// sections: data.sections.map((s) => ({
			// 	...s
			// }))
		}
	}

	site = validateSiteStructure(site)

	const symbols = [
		...site.symbols.map((symbol) => Symbol(symbol)),
		{
			id: uuidv4(),
			site: new_site_id,
			name: 'Content',
			code: {
				html: `<div class="section"><div class="section-container content">{@html content.html}</div></div>`,
				css: `
.content {

  :global(img) {
    width: 100%;
    margin: 2rem 0;
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
  }

  :global(p) {
    padding: 0.25rem 0;
    line-height: 1.5;
  }

  :global(a) {
    text-decoration: underline;
  }

  :global(h1) {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  :global(h2) {
    font-size: 2.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  :global(h3) {
    font-size: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  :global(ul) {
    list-style: disc;
    padding: 0.5rem 0;
    padding-left: 1.25rem;
  }

  :global(ol) {
    list-style: decimal;
    padding: 0.5rem 0;
    padding-left: 1.25rem;
  }

  :global(blockquote) {
    padding: 2rem;
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
  }
}
      `,
				js: ''
			},
			fields: [
				{
					id: createUniqueID(),
					key: 'content',
					label: 'Content',
					type: 'markdown',
					fields: [],
					options: {},
					is_static: false
				}
			],
			content: {
				en: {
					content: {
						markdown: '# This is a content block',
						html: '<h1>This is a content block</h1>'
					}
				}
			},
			_old_id: null
		}
	]

	/** @returns {import('$lib').Section} */
	const Section = (section, page) => {
		let symbol
		let content

		if (section.type === 'component') {
			symbol = symbols.find((s) => s._old_id === section.symbolID)
			content = Object.entries(site.content).reduce((accumulator, [locale, value]) => {
				accumulator[locale] = value?.[page.url]?.[section.id]
				return accumulator
			}, {})
		} else if (section.type === 'content') {
			symbol = symbols.at(-1)
			content = Object.entries(site.content).reduce((accumulator, [locale, value]) => {
				const html = value?.[page.url]?.[section.id]
				accumulator[locale] = {
					content: {
						html,
						markdown: html
					}
				}
				return accumulator
			}, {})
		}

		return {
			id: uuidv4(),
			page: page.id,
			symbol: symbol.id,
			content,
			index: page.sections.findIndex((s) => s.id === section.id)
		}
	}

	const pages = _.flatten(site.pages.map((page) => [Page(page), ...page.pages.map((child) => Page(child))]))

	// children need to be derived after page IDs have been assigned
	const pages_with_children = pages.map((page) => {
		const parent = pages.find((p) => p.pages.find((c) => c.id === page.url))
		return {
			...page,
			parent: parent?.id || null
		}
	})

	/** @returns {Array<import('$lib').Section>} */
	const sections = _.flatten(pages.map((page) => page.sections.map((s) => Section(s, page))))

	const content = Object.entries(site.content).reduce(
		(accumulator, [locale, value]) => {
			accumulator[locale] = {}
			site.fields.forEach((field) => {
				accumulator[locale][field.key] = value?.[field.key] || get_empty_value(field)
			})
			return accumulator
		},
		{
			en: {}
		}
	)

	return {
		site: Site({
			id: new_site_id,
			url: site.id,
			name: site.name,
			code: site.code,
			fields: site.fields,
			content
		}),
		pages: pages_with_children.map((page) => {
			delete page.sections
			delete page.pages
			return page
		}),
		sections,
		symbols: symbols.map((symbol) => {
			delete symbol._old_id
			return symbol
		})
	}
}

function Enclosing_Code(code = { html: { head: '', below: '' }, css: '' }) {
	return {
		head: code.html.head + '\n\n' + `<style>\n${code.css}\n</style>`,
		foot: code.html.below
	}
}

/** @returns {import('$lib').Page_Type} */
function build_standard_page_type(site) {
	return {
		id: uuidv4(),
		name: 'Default',
		code: Enclosing_Code(),
		site: site.id,
		color: null,
		icon: null,
		index: 0
	}
}

export function validateSiteStructure(site) {
	let validated
	try {
		if (defined_structure(site, ['html'])) validated = convertSite(site)
		else if (defined_structure(site, ['content'])) validated = updateSite(site)
		else validated = null
	} catch (e) {
		console.warn('Site is invalid', site)
		validated = null
	}

	return validated

	function updateSite(site) {
		return {
			...site,
			fields: convertFields(site.fields),
			symbols: site.symbols.map((symbol) => ({
				...symbol,
				fields: convertFields(symbol.fields)
			}))
		}
	}

	function convertSite(site) {
		const siteContent = {}
		const updated = {
			id: site.id,
			name: site.name,
			pages: convertPages(site.pages, (page) => {
				siteContent[page.id] = page.content
			}),
			code: convertCode(site),
			symbols: convertSymbols(site.symbols),
			fields: convertFields(site.fields, (field) => {
				siteContent[field.id] = field.content
			}),
			content: {
				en: null
			}
		}
		updated.content['en'] = siteContent

		return updated

		function convertPages(pages = [], fn = (_) => {}) {
			return pages.map((page) => {
				const pageContent = {}
				const updatedPage = {
					id: page.id,
					name: page.name || page.title || '',
					sections: convertSections(page.sections, (section) => {
						pageContent[section.id] = section.content
					}),
					code: convertCode(page),
					fields: convertFields(page.fields, (field) => {
						pageContent[field.id] = field.content
					}),
					pages: convertPages(page.pages)
				}
				fn({
					id: page.id,
					content: pageContent
				})
				return updatedPage
			})

			function convertSections(sections, cb) {
				return sections
					.filter((s) => s.type !== 'options')
					.map((section) => {
						cb({
							id: section.id,
							content: section.value.fields ? _.chain(section.value.fields).keyBy('key').mapValues('value').value() : section.value.html
						})
						return {
							id: section.id,
							type: section.type,
							...(section.symbolID ? { symbolID: section.symbolID } : {})
						}
					})
			}
		}

		function convertCode(obj) {
			return {
				html: obj.html,
				css: obj.css,
				js: obj.js || ''
			}
		}
	}
}

export function convertSymbols(symbols) {
	return symbols.map((symbol) => ({
		type: 'symbol',
		id: symbol.id,
		name: symbol.title || '',
		code: {
			html: symbol.value.html,
			css: symbol.value.css,
			js: symbol.value.js
		},
		fields: convertFields(symbol.value.fields)
	}))
}

export function convertFields(fields = [], fn = () => {}) {
	return fields.map((field) => {
		fn({
			id: field.key,
			content: field.value
		})
		return NewField({
			id: field.id,
			key: field.key,
			label: field.label,
			type: field.type,
			fields: convertFields(field.fields),
			options: field.options || {},
			is_static: field.is_static || false
		})
	})
}

function validate_fields(fields) {
	if (!fields) return []
	return fields.map((field) => ({
		...Field(field),
		is_static: field.is_static,
		fields: validate_fields(field.fields)
	}))
}

// https://stackoverflow.com/questions/24924464/how-to-check-if-object-structure-exists
function defined_structure(obj, attrs) {
	var tmp = obj
	for (let i = 0; i < attrs.length; ++i) {
		if (tmp[attrs[i]] == undefined) return false
		tmp = tmp[attrs[i]]
	}
	return true
}

// convert v2 symbol to v3 symbol
export function validate_symbol(symbol) {
	if (!Array.isArray(symbol.entries)) {
		const v3_fields = flatten_fields({ fields: symbol.fields })
		return Symbol({
			...symbol,
			entries: flatten_content({ content: symbol.content, all_fields: v3_fields }),
			fields: v3_fields
		})
	}

	return symbol
}

// Utilities ///////////////

function flatten_fields({ fields, parent_id = null, result = [], args = {} }) {
	fields.forEach((field, i) => {
		// Add the parent key to each field
		const new_field = {
			...Field({ ...field, index: i }),
			...args,
			id: field.id,
			parent: parent_id
		}
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
				recurse({
					content_value: item,
					locale,
					fields: all_fields.filter((f) => f.parent === field.id),
					parent: id
				})
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
					recurse({
						content_value: value,
						locale,
						fields: all_fields.filter((f) => f.parent === field.id),
						parent: item_id
					})
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
