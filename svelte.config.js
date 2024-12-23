// import adapter from '@sveltejs/adapter-auto'
import adapter from '@sveltejs/adapter-vercel'
import preprocess from 'svelte-preprocess'
import sequence from 'svelte-sequential-preprocessor'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: sequence([
		// ... other preprocessors
		preprocess({
			postcss: true
		})
	]),
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter()
	},
	vitePlugin: {
		// inspector: true
	},
	onwarn: (warning, handler) => {
		// console.log({ warning })
		if (warning.code === 'css-unused-selector') return
		// Handle all other warnings normally
		handler(warning)
	}
}

export default config
