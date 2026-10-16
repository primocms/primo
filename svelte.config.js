import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'internal/build',
			fallback: 'index.html'
		}),
		paths: {
			base: '/admin'
		}
	},
	vitePlugin: {
		// inspector: true
	}
}

export default config
