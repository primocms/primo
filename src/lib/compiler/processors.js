import * as _ from 'lodash-es'
import PromiseWorker from 'promise-worker'
import rollupWorker from './workers/rollup.worker.js?worker'
import postCSSWorker from './workers/postcss.worker.js?worker'
import { render } from 'svelte/server'

// Authentication and dashboards register processors without compiling. Start
// workers only when needed, so redirects do not create and immediately tear
// down idle compiler processes during navigation.
let postcss_worker
let rollup_worker

const COMPILED_COMPONENTS_CACHE = new Map()

/**
 * Compiles and renders a given component or page, caching the result.
 * @async
 * @param {Object} options - The options for rendering.
 * @param {Object|Object[]} options.component - The component(s) to be rendered. Can be a single component or an array of components for a page.
 * @param {{ code: string, data: Object }} [options.head]
 * @param {boolean} [options.buildStatic=true] - Indicates whether to build the component statically or not.
 * @param {"injected" | "external"} [options.css] - Indicates whether to include CSS in the JavaScript bundle.
 * @param {import('@rollup/browser').ModuleFormat} [options.format='esm'] - The module format to use, such as 'esm' for ES Modules.
 * @param {boolean} [options.dev_mode=false] - Whether Svelte should be compiled in dev mode (i.e. attaches LOC for inspecting) or not
 * @param {boolean} [options.independent=false]
 * @param {string[]} [options.runtime=[]] - Svelte runtime functions to include in bundle (eg. mount, unmount, hydrate).
 * @returns {Promise<Object>} Returns a payload containing the rendered HTML, CSS, JS, and other relevant data.
 * @throws {Error} Throws an error if the compilation or rendering fails.
 */
export async function html({ component, head = { code: '', data: {} }, buildStatic = true, css = 'external', format = 'esm', dev_mode = false, runtime = [], independent = false }) {
	// Published sections are hydrated individually, so each must also be a
	// separate SSR root. Render the page head once outside those roots.
	if (buildStatic && independent && Array.isArray(component)) {
		const options = { css, format, dev_mode, runtime }
		const page_head = await html({ ...options, component: [], head })
		if (page_head.error) return page_head
		let body = ''
		let rendered_head = page_head.head || ''
		for (const section of component) {
			const rendered = await html({ ...options, component: section })
			if (rendered.error) return rendered
			body += (section.wrapper_start || '') + (rendered.body || '') + (section.wrapper_end || '')
			rendered_head += rendered.head || ''
		}
		return { body, head: rendered_head }
	}

	let cache_key
	if (!buildStatic) {
		cache_key = JSON.stringify({
			component,
			format,
			runtime
		})
		if (COMPILED_COMPONENTS_CACHE.has(cache_key)) {
			return COMPILED_COMPONENTS_CACHE.get(cache_key)
		}
	}

	const compile_page = Array.isArray(component)

	let res
	try {
		const has_js = compile_page ? component.some((s) => !!s.js) : !!component.js
		rollup_worker ||= new PromiseWorker(new rollupWorker())
		res = await rollup_worker.postMessage({
			component,
			head,
			hydrated: buildStatic && has_js,
			buildStatic,
			css,
			format,
			dev_mode,
			runtime
		})
	} catch (e) {
		console.error('Rollup worker error:', e)
		res = {
			error: e instanceof Error ? e.message : String(e)
		}
	}

	let payload

	if (!res) {
		console.error('Compilation failed: No response from rollup worker')
		payload = {
			html: '<h1 style="text-align: center">could not render</h1>',
			error: 'No response from rollup worker'
		}
		res = {}
	} else if (res.error) {
		console.error('Compilation error from rollup worker:', res.error)
		payload = {
			error: escapeHtml(res.error)
		}
		function escapeHtml(unsafe) {
			return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
		}
	} else if (buildStatic) {
		const blob = new Blob([res.ssr], { type: 'text/javascript' })
		const url = URL.createObjectURL(blob)
		const { default: App } = await import(/* @vite-ignore */ url)
		URL.revokeObjectURL(url)

		let component_data
		if (compile_page) {
			// get the component data for the page
			component_data = component.reduce((accumulator, item, i) => {
				if (!_.isEmpty(item.data)) {
					accumulator[`component_${i}_props`] = item.data
				}
				return accumulator
			}, {})
			component_data.head_props = head.data
		} else {
			component_data = component.data
		}

		try {
			const rendered = render(App, { props: component_data })
			payload = {
				head: rendered.head,
				body: rendered.body,
				js: res.dom
			}
		} catch (e) {
			console.error('Svelte render error:', e)
			const error_msg = e instanceof Error ? e.message : String(e)
			payload = {
				head: '',
				body: '',
				js: '',
				error: `Render error: ${error_msg}`
			}
		}
	} else {
		payload = {
			js: res.dom
		}
	}

	if (!buildStatic && !payload.error) {
		COMPILED_COMPONENTS_CACHE.set(cache_key, payload)
	}

	return payload
}

const cssMap = new Map()
export async function css(raw) {
	// return {
	//   css: ''
	// }
	if (cssMap.has(raw)) {
		return { css: cssMap.get(raw) }
	}
	let payload
	try {
		postcss_worker ||= new PromiseWorker(new postCSSWorker())
		payload = await postcss_worker.postMessage({
			css: raw
		})
	} catch (error) {
		return {
			error: serializeCssWorkerError(error)
		}
	}

	if (!payload) {
		return { css: '' }
	}

	if (payload.error) {
		return {
			error: serializeCssWorkerError(payload.error)
		}
	}

	const processedCss = typeof payload.css === 'string' ? payload.css : typeof payload === 'string' ? payload : ''

	if (!processedCss) {
		return { css: '' }
	}

	cssMap.set(raw, processedCss)
	return {
		css: processedCss
	}
}

function serializeCssWorkerError(error) {
	if (!error) return 'Unknown CSS error'
	if (typeof error === 'string') return error

	const name = error.name || 'CssError'
	const reason = error.reason || error.message || String(error)
	const line = error.line || error?.input?.line
	const column = error.column || error?.input?.column
	const location = line || column ? ` (line ${line ?? '?'}${column ? `, column ${column}` : ''})` : ''

	let message = `${name}: ${reason}${location}`

	return message
}
