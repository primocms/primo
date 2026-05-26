import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	optimizeDeps: {
		exclude: ['@rollup/browser']
	},
	server: {
		host: true
	},
	build: {
		rollupOptions: {
			output: {
				hashCharacters: 'base36'
			}
		}
	},
	plugins: [sveltekit()]
})
