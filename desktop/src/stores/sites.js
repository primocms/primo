import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { find as _find } from 'lodash-es';

const store = writable([]);

if (browser) initializSiteData();

async function initializSiteData() {
	const data = window.primo?.data; // preload.cjs
	if (!data) return;
	const siteFiles = data.load();

	const rebuiltSites = siteFiles.map(({ data, preview, config }) => {
		return {
			id: data.id,
			name: data.name,
			activeDeployment: config?.deployment || null,
			data,
			preview,
		};
	});

	store.set(rebuiltSites);
}
export default {
	update: store.update,
	set: store.set,
	subscribe: store.subscribe,
};
