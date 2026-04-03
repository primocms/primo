import { rollup } from '@rollup/browser'
import svelteWorker from './svelte.worker?worker'
import PromiseWorker from 'promise-worker'
import registerPromiseWorker from 'promise-worker/register'
import commonjs from './plugins/commonjs'
import json from './plugins/json'
import glsl from './plugins/glsl'
import { VERSION as SVELTE_VERSION } from 'svelte/compiler'

const sveltePromiseWorker = new PromiseWorker(new svelteWorker())

// Based on https://github.com/pngwn/REPLicant & the Svelte REPL package (https://github.com/sveltejs/sites/tree/master/packages/repl)

// Use esm.sh for all remote module resolution
const CDN_URL = 'https://esm.sh'
const SVELTE_CDN = `${CDN_URL}/svelte@${SVELTE_VERSION}`

// In-memory cache for external modules (persists for worker lifetime)
const module_cache = new Map()

registerPromiseWorker(rollup_worker)
async function rollup_worker({ component, head, hydrated, buildStatic = true, css = 'external', format = 'esm', dev_mode = false, runtime = [] }) {
	const final = {
		ssr: '',
		dom: '',
		error: ''
	}

	const component_lookup = new Map()

	const App_Wrapper = (components, head) => {
		const field_keys = Object.entries(head.data).filter((field) => field[0])
		return `
			<svelte:head>
				${head.code}
			</svelte:head>
			<script>
			  let props = $props();

				${components.map((_, i) => `import Component_${i} from './Component_${i}.svelte';`).join('\n')}
				${components.map((_, i) => `let { component_${i}_props } = props;`).join(`\n`)}

				let { head_props } = props;
				${field_keys.map((field) => `let ${field[0]} = head_props['${field[0]}'];`).join(`\n`)}
			</script>
			${components.map((component, i) => (component.wrapper_start ?? '') + `<Component_${i} {...component_${i}_props} />` + (component.wrapper_end ?? '')).join('\n')}
		`
	}

	const Component = (component) => {
		let { html, css, js, data } = component

		const field_keys = Object.keys(data).filter((key) => !!key)

		// Check if user's JS already declares props (to avoid duplicate declarations)
		const user_declares_props = js && (js.includes('$props()') || js.includes('$props('))

		// html must come first for LoC (inspector) to work
		return `\
					${html}
          <script>
            ${user_declares_props ? '' : `let { ${field_keys.join(', ')} } = $props();` /* e.g. let { heading, body } = $props(); */}
            ${js}
          </script>
          ${css ? `<style>${css}</style>` : ``}`
	}

	const Entrypoint = () => {
		let code = `export { default } from './App.svelte';\n`
		if (runtime.length > 0) code += `export { ${runtime.join(', ')} } from 'svelte'\n`
		return code
	}

	function generate_lookup(component, head) {
		if (Array.isArray(component)) {
			// build page (sections as components)
			component.forEach((section, i) => {
				const code = Component(section)
				component_lookup.set(`./Component_${i}.svelte`, code)
			})
			component_lookup.set(`./App.svelte`, App_Wrapper(component, head))
			component_lookup.set(`./entry.js`, Entrypoint())
		} else {
			// build individual component
			component_lookup.set(`./App.svelte`, Component(component))
			component_lookup.set(`./entry.js`, Entrypoint())
		}
	}

	generate_lookup(component, head)

	if (buildStatic) {
		try {
			const bundle = await compile({
				generate: 'server',
				css: 'injected',
				runes: true
			})

			const output = (await bundle.generate({ format })).output[0].code
			final.ssr = output
		} catch (error) {
			noteBuildError(error)
			return final
		}
	} else {
		try {
			const bundle = await compile({
				generate: 'client',
				css,
				dev: dev_mode,
				runes: true
			})

			const output = (await bundle.generate({ format })).output[0].code
			final.dom = output
		} catch (error) {
			noteBuildError(error)
			return final
		}
	}

	// If static build needs to be hydrated, include Svelte JS (or just render normal component)
	if (hydrated) {
		try {
			const bundle = await compile({
				generate: 'client',
				css: 'external',
				runes: true
			})
			const output = (await bundle.generate({ format })).output[0].code
			final.dom = output
		} catch (error) {
			noteBuildError(error)
			return final
		}
	}

	async function compile(svelteOptions = {}) {
		try {
			return await rollup({
				input: './entry.js',
				onwarn(warning, warn) {
					// Suppress circular dependency warnings from esm.sh Svelte modules
					if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.ids?.some((id) => id.includes('esm.sh/svelte'))) {
						return
					}
					// Use default warning handler for other warnings
					warn(warning)
				},
				plugins: [
					commonjs,
					{
						name: 'repl-plugin',
						async resolveId(importee, importer) {
							// 1) Virtual esm-env
							if (importee === 'esm-env') return 'virtual:esm-env'

							// 2) Local virtual files (in-memory Svelte sources)
							if (component_lookup.has(importee)) return importee

							// 3) Absolute remote URL stays as-is
							if (/^https?:/.test(importee)) return importee

							// 4) Resolve relative from remote importer
							if (importee.startsWith('.')) {
								if (importer && /^https?:/.test(importer)) return new URL(importee, importer).href
								return importee
							}

							// 5) Handle esm.sh absolute subpaths
							if (importer && importer.startsWith(`${CDN_URL}/`)) {
								if (importee.startsWith(`${CDN_URL}/`)) return importee
								if (importee.startsWith('/')) return new URL(importee, CDN_URL).href
							}

							// 6) Svelte runtime pinned
							if (importee === 'svelte') return SVELTE_CDN
							if (importee.startsWith('svelte/')) return `${SVELTE_CDN}/${importee.slice('svelte/'.length)}`

							// 7) Bare package → let esm.sh resolve
							return `${CDN_URL}/${importee}`
						},
						async load(id) {
							if (id === 'virtual:esm-env') {
								return `export const DEV = false; export const PROD = true; export const BROWSER = true;`
							}
							if (component_lookup.has(id)) return component_lookup.get(id)

							// Fetch external modules with caching
							if (/^https?:/.test(id)) {
								// Check cache first
								if (module_cache.has(id)) {
									return module_cache.get(id)
								}

								try {
									const response = await fetch(id)
									if (!response.ok) {
										throw new Error(`Failed to fetch ${id}: ${response.status} ${response.statusText}`)
									}
									const code = await response.text()

									// Cache the result
									module_cache.set(id, code)
									return code
								} catch (error) {
									console.error(`Error loading external module: ${id}`, error)
									throw error
								}
							}

							return null
						},
						async transform(code, id) {
							// our only transform is to compile svelte components
							//@ts-ignore
							if (!/.*\.svelte/.test(id)) return null

							try {
								const res = await sveltePromiseWorker.postMessage({
									code,
									svelteOptions
								})
								return res.code

								// TODO: reinstate warnings, pass along to UI instead of throwing
								// const warnings = res.warnings
								// 	.filter((w) => !w.message.startsWith(`Component has unused export`))
								// 	.filter((w) => !w.message.startsWith(`A11y: <img> element should have an alt attribute`))
								// 	.filter((w) => w.code !== `a11y-missing-content`)
								// 	.filter((w) => !w.message.startsWith(`Unused CSS selector`)) // TODO: reinstate
								// if (warnings[0]) {
								// 	final.error = warnings[0].message
								// 	return ''
								// } else {
								// 	return res.code
								// }
							} catch (e) {
								noteBuildError(e, id)
								return ''
							}
						}
					},
					json,
					glsl
					// replace({
					//   'process.env.NODE_ENV': JSON.stringify('production'),
					// }),
				]
				// inlineDynamicImports: true
			})
		} catch (error) {
			noteBuildError(error)
			throw error
		}
	}

	return final

	function noteBuildError(error, id) {
		const error_message = error instanceof Error ? error.message : String(error)
		console.error('Build error:', error_message, error)

		if (final.error) return
		final.error = formatRollupError(error, id)
	}
}

function formatRollupError(error, id) {
	if (!error) return 'Unknown build error'
	if (typeof error === 'string') return error

	const name = error.name || error.code || 'BuildError'
	const plugin = error.plugin ? `[${error.plugin}] ` : ''
	const reason = error.message || error.reason || String(error)

	const line = error.loc?.line ?? error.start?.line ?? error.line
	const column = error.loc?.column ?? error.start?.column ?? error.column

	const position = line || column ? [typeof line === 'number' ? `line ${line}` : null, typeof column === 'number' ? `column ${column}` : null].filter(Boolean).join(', ') : ''

	let message = `${plugin}${name}: ${reason}`
	if (position) {
		message += `\n${position}`
	}

	const frame = typeof error.frame === 'string' ? error.frame.trim() : ''
	const docLinks = collectDocLinks(error)
	if (frame) {
		message += `\n\n${frame}`
	}

	if (docLinks.length) {
		message += `\n\n${docLinks.join('\n')}`
	}

	return message
}

function collectDocLinks(error) {
	const links = new Set()

	if (typeof error.url === 'string') {
		links.add(error.url)
	}

	const maybeStack = typeof error.stack === 'string' ? error.stack.split('\n') : []
	for (const raw of maybeStack) {
		const line = raw.trim()
		if (!line) continue
		if (/^https?:\/\//.test(line)) {
			links.add(line)
		}
	}

	return Array.from(links)
}
