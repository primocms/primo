import { get, writable, derived } from 'svelte/store';
import { Page, Site } from '../../const';

export const id = writable('default');
export const name = writable('');
export const pages = writable([ Page('index') ]);
export const fields = writable([]);
export const symbols = writable([]);
export const code = writable(Site().code);
export const content = writable(Site().content);

export function update(props) {
	if (props.id) {
		id.set(props.id);
	}
	if (props.name) {
		name.set(props.name);
	}
	if (props.pages) {
		pages.set(props.pages);
	}
	if (props.code) {
		code.set(props.code);
	}
	if (props.fields) {
		fields.set(props.fields);
	}
	if (props.symbols) {
		symbols.set(props.symbols);
	}
	if (props.content) {
		content.set(props.content);
	}
}

// conveniently get the entire site
export const site = derived([id, name, pages, code, fields, symbols, content], ([id, name, pages, code, fields, symbols, content]) => {
	return {
		id,
		name,
		pages,
		code,
		fields,
		symbols,
		content,
	};
});

export default site;