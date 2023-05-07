import { writable, derived } from 'svelte/store';
import { Site } from '../../const';

export const id = writable('default');
export const url = writable('');
export const name = writable('');
export const fields = writable([]);
export const code = writable(Site().code);
export const content = writable(Site().content);

export function update(props) {
	if (props.id) {
		id.set(props.id);
	}
	if (props.url) {
		url.set(props.url);
	}
	if (props.name) {
		name.set(props.name);
	}
	if (props.code) {
		code.set(props.code);
	}
	if (props.fields) {
		fields.set(props.fields);
	}
	if (props.content) {
		content.set(props.content);
	}
}

// conveniently get the entire site
/** @type {import('svelte/store').Readable<import('$lib').Site>} */
export const site = derived([id, url, name, code, fields, content], ([id, url, name, code, fields, content]) => {
	return {
		id,
		url,
		name,
		code,
		fields,
		content,
	};
});

export default site;