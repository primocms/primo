/// <reference types="vitest" />

import preprocess from 'svelte-preprocess';
import vercel from '@sveltejs/adapter-vercel';

const IGNORED_WARNINGS = [`'__DESKTOP_VERSION__' is not defined`];

const config = {
	onwarn: (warning, handler) => {
		if (!IGNORED_WARNINGS.includes(warning.message)) handler(warning);
	},
	kit: {
		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
		adapter: vercel(),
		vite: {
			server: {
				fs: {
					// throws an error without this when importing Fira font
					allow: ['..', 'node_modules/@fontsource/fira-code']
				}
			},
			define: {
				__DESKTOP_VERSION__: JSON.stringify(process.env.npm_package_version)
			},
			test: {
				// ...
			}
		}
	},
	preprocess: preprocess({
		postcss: true
	})
};

export default config;
