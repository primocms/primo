import { get, writable, derived } from 'svelte/store';
import { Page, Site } from '../../const';
import { createStack } from '../../libraries/svelte-undo';

export const id = writable('default');
export const name = writable('');
export const pages = writable([Page('index')]);
export const fields = writable([]);
export const symbols = writable([]);
export const code = writable(Site().code);
export const content = writable(Site().content);

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

export let timeline = createStack(get(site));
export function setTimeline(site) {
	timeline.set(site);
}
