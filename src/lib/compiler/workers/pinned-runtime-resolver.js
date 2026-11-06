const prefix = 'primo-runtime:'

/** Resolve the locked runtime graph without changing authored package imports.
 * @param {{exports: Record<string, any>, imports?: Record<string, any>}} svelte
 * @param {Record<string, string>} assets
 */
export function createPinnedRuntime(svelte, assets) {
	/** @param {any} value @param {boolean} server @returns {string | undefined} */
	function target(value, server) {
		if (typeof value === 'string') return value
		return value?.[server ? 'worker' : 'browser'] ?? value?.default
	}
	/** @param {string} path */
	function checked(path) {
		if (!assets[path]) throw new Error(`Missing packaged compiler runtime: ${path}`)
		return prefix + path
	}
	return {
		/** @param {string} source @param {string | undefined} importer @param {boolean} server */
		resolve(source, importer, server) {
			// These authored imports are not core runtime modules; retain the
			// existing version-pinned package resolver for them.
			if (source === 'svelte/compiler' || source === 'svelte/package.json') return null
			if (source === 'svelte' || source.startsWith('svelte/')) {
				const path = target(svelte.exports[source === 'svelte' ? '.' : './' + source.slice(7)], server)
				if (!path) throw new Error(`Svelte has no runtime export: ${source}`)
				return checked('svelte/' + path.replace(/^\.\//, ''))
			}
			if (!importer?.startsWith(prefix)) return null
			if (source.startsWith('.')) {
				const path = new URL(source, 'https://runtime.invalid/' + importer.slice(prefix.length)).pathname.slice(1)
				return checked(path)
			}
			if (source.startsWith('#') && importer.startsWith(prefix + 'svelte/')) {
				const path = target(svelte.imports?.[source], server)
				if (!path) throw new Error(`Svelte has no runtime import: ${source}`)
				return checked('svelte/' + path.replace(/^\.\//, ''))
			}
			if (source === 'clsx') return checked('clsx/dist/clsx.mjs')
			if (source === 'devalue') return checked('devalue/index.js')
			return null
		},
		/** @param {string} id */
		asset(id) {
			if (!id.startsWith(prefix)) return null
			const path = id.slice(prefix.length)
			const url = assets[path]
			if (!url) throw new Error(`Missing packaged compiler runtime: ${path}`)
			// Keep logical identity visible in download diagnostics and retry tests.
			return url + (url.includes('?') ? '&' : '?') + 'svelte-module=' + encodeURIComponent(path)
		}
	}
}
