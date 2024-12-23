import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
// import ClassMangler from './class-mangler';
// import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
	plugins: [
		// ClassMangler({
		//   dev: true
		// }),
		// nodePolyfills(), // fix dev mode (to enable ___svelte.loc for inspecting)
		sveltekit()
	],
	optimizeDeps: {
		exclude: ['@atlaskit/pragmatic-drag-and-drop-hitbox']
	}
})
