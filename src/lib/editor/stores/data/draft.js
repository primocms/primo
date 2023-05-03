import { writable, derived } from 'svelte/store';
import { Site } from '../../const';

export const id = writable('default');
export const name = writable('');
export const fields = writable([]);
export const code = writable(Site().code);
export const content = writable(Site().content);

export function update(props) {
	if (props.id) {
		id.set(props.id);
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
export const site = derived([id, name, code, fields, content], ([id, name, code, fields, content]) => {
	return {
		id,
		name,
		code,
		fields,
		content,
	};
});

export default site;