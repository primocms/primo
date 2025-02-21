import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash-es'
import {design_values} from './constants'

/**
 * @param row 
 * @returns {import('$lib').Entry}
 */
export const Content_Row = (row = {}) => ({
	id: uuidv4(),
	value: row.value !== undefined ? row.value : null,
	locale: row.locale || null,
	field: row.field || null,
	index: row.index === undefined ? null : row.index,
	parent: row.parent || null,
	metadata: row.metadata || null,
	section: row.section || null,
	symbol: row.symbol || null,
	library_symbol: row.library_symbol || null,
	page: row.page || null,
	site: row.site || null,
	page_type: row.page_type || null
})

export const Field_Row = (field = {}) => ({
	id: uuidv4(),
	key: field.key || '',
	label: field.label || '',
	type: field.type || 'text',
	options: field.options || {},
	index: field.index === undefined ? null : field.index,
	parent: field.parent || null,
	source: field.source || null
})

/**
 * Creates a new field object with default values.
 * @param field - The field properties to be applied to the new field
 * @returns {import('$lib').Field}
 */
export const Field = (field = {}) => ({
	// id: field.id || createUniqueID(), // necessary to maintain id? removing to address corrupt data where IDs the same
	id: uuidv4(),
	key: field.key || '',
	label: field.label || '',
	type: field.type || 'text',
	options: field.options || {},
	index: typeof(field.index) === 'number' ? field.index : 0,
	parent: field.parent || null,
	source: field.source || null
})

/**
 * @param section
 * @returns {import('$lib').Section}
 */
export const Section = (section) => ({
	id: section.id || uuidv4(),
	index: section.index || 0,
	symbol: section.symbol || null,
	page: section.page || null,
	page_type: section.page_type || null,
	// created_at: section.created_at || new Date().toISOString(),
	master: section.master || null,
	palette: section.palette || null,
	entries: section.entries || [],
	owner_site: section.owner_site || null
})

/**
 * Creates a new symbol object with default values.
 * @param symbol - The symbol properties to be applied to the new symbol
 * @returns {import('$lib').Symbol}
 */
export const Symbol = (symbol = {}) => ({
	id: symbol.id || uuidv4(),
	name: symbol.name || '',
	code: symbol.code || {
		css: '',
		html: '',
		js: ''
	},
	fields: symbol.fields || [],
	entries: symbol.entries || [],
	owner_site: symbol.site || null,
	index: symbol.index === undefined ? null : symbol.index,
	page_types: []
})

/**
 * Creates a new page object with default values.
 * @param page - The page properties to be applied to the new page
 * @returns {import('$lib').Page}
 */
export const Page = (page = {}) => ({
	id: page.id || uuidv4(),
	slug: page.slug || '',
	name: page.name || '',
	parent: page.parent || null,
	// created_at: new Date().toISOString(),
	index: page.index !== undefined ? page.index : null,
	page_type: page.page_type || Page_Type(),
	entries: page.entries || [],
	owner_site: page.owner_site || null,
	...page // TODO: remove
})

/**
 * Creates a new page object with default values.
 * @param page - The page properties to be applied to the new page
 * @returns {import('$lib').Page_Type}
 */
export const Page_Type = (page_type = {}) => ({
	id: page_type.id || uuidv4(),
	name: page_type.name || '',
	code: {
		head: '',
		foot: ''
	},
	fields: [],
	entries: [],
	color: page_type.color || '#222',
	icon: page_type.icon || 'iconoir:page',
	owner_site: page_type.site,
	index: page_type.index || 0
	// ...page_type
})

/**
 * Creates a new site object with default values.
 * @param site - The site properties to be applied to the new site
 * @returns {import('$lib').Site}
 */
export const Site = (site = {}) => ({
	id: site.id || uuidv4(),
	// slug: '',
	name: site.name || '',
	code: site.code || {
		head: '',
		foot: ''
	},
	fields: site.fields || [],
	entries: site.entreies || [],
	design: site.design || _.cloneDeep(design_values),
	custom_domain: site.custom_domain || '',
	created_at: new Date().toISOString(),
	...site
})

export const design_tokens = {
	heading_font: {
		label: 'Heading Font',
		type: 'font-family',
		variable: 'heading-font',
		group: ''
	},
	body_font: {
		label: 'Body Font',
		type: 'font-family',
		variable: 'body-font',
		group: ''
	},
	primary_color: {
		label: 'Primary Color',
		type: 'color',
		variable: 'primary-color',
		group: ''
	},
	radius: {
		label: 'Border Radius',
		type: 'border-radius',
		variable: 'radius',
		group: ''
	},
	shadow: {
		label: 'Shadow',
		type: 'box-shadow',
		variable: 'shadow',
		group: ''
	}
}

export const Site_Tokens_CSS = (values) => {
	return `
		<link rel="preconnect" href="https://fonts.googleapis.com">
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
		<link href="https://fonts.googleapis.com/css2?family=${values['heading_font'].replace(/ /g, '+')}:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=${values['body_font'].replace(
		/ /g,
		'+'
	)}:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700" rel="stylesheet">
	<style>
	:root {\n${Object.entries(design_tokens)
		.map(([token, { variable }]) => `--${variable}: ${values[token]};`)
		.join('\n')}}
	</style>
	`
}
