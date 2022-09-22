/// <reference types="vitest" />

import preprocess from 'svelte-preprocess';
import vercel from '@sveltejs/adapter-vercel';

const IGNORED_WARNINGS = [`'__DESKTOP_VERSION__' is not defined`];

const config = {
	onwarn: (warning, handler) => {
		if (!IGNORED_WARNINGS.includes(warning.message)) handler(warning);
	},
	kit: {
		adapter: vercel()
	},
	preprocess: preprocess({
		postcss: true
	})
};

export default config;
