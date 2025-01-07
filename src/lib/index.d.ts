type Entry_ID = string
export type Entry = {
	id: Entry_ID
	value: Entry_Value
	locale: string
	parent: Entry_ID
	field: Field_ID
	index: number | null
	metadata: object | null
	section?: Section_ID | null
	symbol?: Symbol_ID | null
	page?: Page_ID | null
	page_type?: Page_Type_ID | null
	site?: Site_ID | null
}

type Field_ID = string
export type Field = {
	id: Field_ID
	key: string
	label: string
	type?: 'repeater' | 'group' | 'text' | 'markdown' | 'image' | 'number' | 'switch' | 'url' | 'link' | 'select' | 'icon' | 'info' | null
	addon_type?: string | null
	options: object
	index: number
	parent: Field_ID | null
	symbol?: Symbol_ID | null
	page_type?: Page_Type_ID | null
	site?: Site_ID | null,
	source?: Field_ID | null
}

type Section_ID = string
export type Section = {
	id: Section_ID
	index: number
	symbol: Symbol_ID
	palette: Section_ID
	page: Page_ID | null
	page_type: Page_Type_ID | null
	master: { symbol: Symbol_ID, index: number } | null
	entries: Array<Entry>
}

type Symbol_ID = string
export type Symbol = {
	id: Symbol_ID
	name: string
	code: Code
	site: Site_ID
	index: number,
	entries: Array<Entry>
	fields: Array<Field>
	page_types: Array<Page_Type_ID>
}

type Page_ID = string
export type Page = {
	id: Page_ID
	name: string
	slug: string
	// code: Enclosing_Code // removing for now (w/ fields & content)
	parent: Page_ID | null
	page_type: Page_Type_ID | Page_Type
	site?: Site_ID | null
	index?: number
	entries: Array<Entry>
}

type Page_Type_ID = string
export type Page_Type = {
	id: Page_Type_ID
	name: string
	code: Enclosing_Code
	color: string | null
	icon: string | null
	site?: Site_ID
	index?: number
	fields: Array<Field>
	entries: Array<Entry>
	created_at?: string
}

type Site_ID = string
export type Site = {
	id: string
	name: string
	slug?: string
	code: Enclosing_Code
	design: {
		heading_font: string
		body_font: string
		brand_color: string
		accent_color: string
		roundness: string
		depth: string
	}
	entries: Array<Entry>
	fields: Array<Field>
	custom_domain: string | null
	custom_domain_validated?: boolean
	distribution_domain_name?: string
	validation_record?: {
		type: string
		name: string
		value: string
	}
}

export type User = {
	id: string
	email: string
	role: 'DEV' | 'EDITOR'
	collaborator: boolean
	created_at: string
	pro: boolean
}

export type Site_Data = {
	site: Site
	pages: Array<Page>
	page_types: Array<Page_Type>
	sections: Array<Section>
	symbols: Array<Symbol>
}

//////////////////////////////
// Code Types ////////////////
//////////////////////////////

type Code = {
	html: string
	css: string
	js: string
}

type Enclosing_Code = {
	head: string
	foot: string
}

//////////////////////////////
// Entry Values ////////////
//////////////////////////////
type Entry_Value = Text_Value | Number_Value | Image_Value | Markdown_Value | Switch_Value | Link_Content
type Text_Value = string
type Image_Value = {
	url: string
	alt: string
}
type Markdown_Value = {
	html: string
	markdown: string
}
type Number_Value = number
type Switch_Value = boolean
type Repeater_Value = Array<Group_Value>
type Group_Value = {
	[subfield_key: string]: Entry_Value
}
type Link_Content = {
	url: string
	label: string
}
