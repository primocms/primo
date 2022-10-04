import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';

const config: UserConfig = {
	plugins: [sveltekit()],
	server: {
		fs: {
			// throws an error without this when importing Fira font
			allow: ['..', 'node_modules/@fontsource/fira-code']
		}
	},
	optimizeDeps: {
		force: true
	},
	build: {
		sourcemap: true,
	},
};

export default config;
