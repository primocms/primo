export type Section = {
	id: string;
	content: Content;
	index: number;
	symbol: Symbol;
	page: string;
	created_at?: string;
}

export type Symbol = {
	id: string;
	name: string;
	code: Code,
	fields: Array<Field>;
	content: Content;
}

export type Block_Code = {
	html: string;
	css: string;
	js: string;
}

export type Page_Code = {
	html: {
		head: string;
		below: string;
	};
	css: string;
	js: string;
}

export type Content = {
	en: {
		[field_key?: string]: any; //
	};
	[locale: string]: {
		[field_key?: string]: any; //
	};
}

export type Field = {
	id: string,
	key: string,
	label: string,
	type: string,
	fields: Array<Field>,
	options: object,
	is_static: boolean
}

export type Page = {
	id: string;
	name: string;
	url: string;
	code: Page_Code;
	fields: Array<Field>;
	content: Content;
	site: string;
	parent: string | null;
	created_at?: string;
}

export type Site = {
	id: string;
	name: string;
	url: string;
	code: Page_Code;
	fields: Array<Field>;
	content: Content;
	active_deployment?: object | null;
	created_at?: string;
}

export type User = {
	id: string;
	email: string;
	server_member: boolean;
	admin: boolean;
	role: 'DEV' | 'EDITOR';
	created_at: string;
}

export type Site_Data = {
	site: Site;
	pages: Array<Page>;
	sections: Array<Section>;
	symbols: Array<Symbol>;
}