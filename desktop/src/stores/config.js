import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const store = writable({
	saveDir: '',
	hosts: [],
	serverConfig: {
		url: '',
		token: '',
	},
	machineID: null,
	telemetryAllowed: true,
	language: 'en',
});

if (browser) {
	const config = window.primo?.config;
	if (config) {
		store.set({
			saveDir: config.getSavedDirectory(),
			hosts: config.getHosts(),
			serverConfig: config.getServerConfig(),
			machineID: config.getMachineID(),
			language: config.getLanguage(),
			telemetryAllowed: config.getTelemetryAllowed()
		});
		store.subscribe(c => {
			config.setHosts(c.hosts);
			config.setServerConfig(c.serverConfig);
			config.setLanguage(c.language);
			config.setTelemetryAllowed(c.telemetryAllowed);
		});
	}
}

export default store;
