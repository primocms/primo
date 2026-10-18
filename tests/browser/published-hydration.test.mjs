import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { build } from 'esbuild'
import { compile, compileModule } from 'svelte/compiler'
import { render } from 'svelte/server'
import * as _ from 'lodash-es'
import { chromium } from '@playwright/test'
import { createModuleLoader } from '../../src/lib/compiler/workers/module_loader.js'

// Run the real worker's virtual sources, transform and options through a local
// bundler adapter. Only CDN resolution and worker transport are replaced: the
// test is deterministic offline and uses the installed, pinned Svelte runtime.
const root = new URL('../../', import.meta.url)
const workerSource = (await readFile(new URL('src/lib/compiler/workers/rollup.worker.js', root), 'utf8')).replace(/^import .*$/gm, '').replace(/^const sveltePromiseWorker = .*$/m, '')
const processorSource = (await readFile(new URL('src/lib/compiler/processors.js', root), 'utf8'))
	.replace(/^import .*$/gm, '')
	.replace(/^(?:const|let) (postcss_worker|rollup_worker)(?: = .*)?$/gm, '')
	.replace(/const blob = new Blob\([\s\S]*?URL.revokeObjectURL\(url\)/, 'const { default: App } = await importSSR(res.ssr)')
	.replaceAll('export async function ', 'async function ')

async function fixture({ transformSources = [] } = {}) {
	const filenames = []
	const temp = await mkdtemp(new URL('.hydration-test-', root).pathname)
	let mode = 'server',
		serial = 0,
		worker
	const rollup = async ({ input, plugins }) => ({
		generate: async () => {
			const plugin = plugins.find((p) => p.name === 'repl-plugin')
			for (const { source, id } of transformSources) await plugin.transform(source, id)
			const bundled = await build({
				stdin: { contents: await plugin.load(input), resolveDir: root.pathname },
				bundle: true,
				write: false,
				format: 'esm',
				platform: mode === 'server' ? 'node' : 'browser',
				conditions: mode === 'client' ? ['browser'] : [],
				external: mode === 'server' ? ['svelte', 'svelte/*'] : [],
				plugins: [
					{
						name: 'worker-virtual-files',
						setup(b) {
							b.onResolve({ filter: /^\.\// }, async (args) => {
								const source = await plugin.load(args.path)
								if (source != null) return { path: args.path, namespace: 'virtual' }
							})
							b.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args) => {
								const source = await plugin.load(args.path)
								const transformed = await plugin.transform(source, args.path)
								return { contents: transformed || source, loader: 'js', resolveDir: root.pathname }
							})
						}
					}
				]
			})
			return { output: [{ code: bundled.outputFiles[0].text }] }
		}
	})
	const sveltePromiseWorker = { postMessage: async ({ code, svelteOptions, module }) => {
		filenames.push(svelteOptions.filename)
		return { code: (module ? compileModule(code, { generate: svelteOptions.generate, dev: svelteOptions.dev }) : compile(code, svelteOptions)).js.code }
	} }
	Function(
		'rollup',
		'sveltePromiseWorker',
		'registerPromiseWorker',
		'SVELTE_VERSION',
		'preview_runtime',
		'commonjs',
		'json',
		'glsl',
		'createModuleLoader',
		workerSource
	)(rollup, sveltePromiseWorker, (fn) => (worker = fn), 'test', '', {}, {}, {}, createModuleLoader)
	const transport = {
		postMessage: async (options) => {
			mode = options.buildStatic ? 'server' : 'client'
			return worker(options)
		}
	}
	const importSSR = async (source) => {
		const file = new URL(`ssr-${serial++}.mjs`, `file://${temp}/`)
		await writeFile(file, source)
		return import(file.href)
	}
	const html = Function('_', 'rollup_worker', 'postcss_worker', 'render', 'importSSR', processorSource + '\nreturn html;')(_, transport, {}, render, importSSR)
	return { html, filenames, cleanup: () => rm(temp, { recursive: true, force: true }) }
}

for (const reversed of [false, true]) {
	test(`published sections hydrate in place with independent heads (reverse=${reversed})`, async () => {
		const f = await fixture()
		const browser = await chromium.launch({ headless: true })
		try {
			const blocks = [
				{
					filename: 'symbol-hero.svelte',
					html: '<svelte:head><link rel="canonical" href={canonical} /></svelte:head><h1>{title}</h1><button onclick={() => count++}>{count}</button>',
					js: 'let {title, canonical} = $props(); let count = $state(0);',
					css: 'h1 { color: red }',
					data: { title: 'Hello', canonical: 'https://example.test/' }
				},
				{
					filename: 'symbol-list.svelte',
					html: '<svelte:head><meta name="list-head" content="one" /></svelte:head><section><h2>List</h2></section>{#each items as item}<p>{item}</p>{/each}',
					js: 'let {items} = $props();',
					css: '',
					data: { items: ['one', 'two'] }
				},
				{ filename: 'symbol-seo.svelte', html: '<svelte:head><meta name="seo-only" content="yes" /></svelte:head>', js: 'let unused = 0;', css: '', data: {} }
			]
			const sections = blocks.map((block, i) => ({ ...block, wrapper_start: `<div id="section-${i}">`, wrapper_end: '</div>' }))
			const ssr = await f.html({ component: sections, head: { code: '<title>Page title</title>', data: {} }, independent: true })
			assert.equal(ssr.error, undefined)
			const clients = []
			for (const component of blocks) {
				const result = await f.html({ component, buildStatic: false, runtime: ['hydrate'] })
				assert.equal(result.error, undefined)
				clients.push(result.js)
			}
			const page = await browser.newPage()
			const errors = []
			page.on('pageerror', (e) => errors.push(e.message))
			page.on('console', (m) => {
				if (/hydrat|Failed/.test(m.text())) errors.push(m.text())
			})
			await page.setContent(`<html><head>${ssr.head}</head><body>${ssr.body}</body></html>`)
			await page.evaluate(() => {
				window.originals = [...document.querySelectorAll('[id^="section-"]')].map((el) => [...el.childNodes])
			})
			for (const i of reversed ? [2, 1, 0] : [0, 1, 2]) {
				await page.evaluate(
					async ({ js, i, props }) => {
						const module = await import(URL.createObjectURL(new Blob([js], { type: 'text/javascript' })))
						module.hydrate(module.default, { target: document.querySelector(`#section-${i}`), props })
					},
					{ js: clients[i], i, props: blocks[i].data }
				)
			}
			assert.equal(
				await page.evaluate(() => window.originals.every((nodes, i) => nodes.every((node, j) => node === document.querySelector(`#section-${i}`).childNodes[j] && node.isConnected))),
				true,
				'SSR nodes must survive hydration'
			)
			assert.equal(await page.locator('head title').count(), 1)
			for (const selector of ['link[rel=canonical]', 'meta[name=list-head]', 'meta[name=seo-only]']) assert.equal(await page.locator(`head ${selector}`).count(), 1)
			assert.equal(await page.locator('h1').evaluate((el) => getComputedStyle(el).color), 'rgb(255, 0, 0)')
			await page.locator('button').click()
			assert.equal(await page.locator('button').textContent(), '1')
			assert.deepEqual(errors, [])
		} finally {
			await browser.close()
			await f.cleanup()
		}
	})
}


test('imported components retain their own compiler identity', async () => {
	const dependency = 'https://components.example.test/Child.svelte'
	const f = await fixture({ transformSources: [{ id: dependency, source: '<h2>Child</h2><style>h2 { color: blue }</style>' }] })
	try {
		for (const buildStatic of [true, false]) {
			const result = await f.html({ component: { filename: 'symbol-parent.svelte', html: '<h1>Parent</h1>', js: '', css: 'h1 { color: red }', data: {} }, buildStatic })
			assert.equal(result.error, undefined)
		}
		assert.ok(f.filenames.includes('symbol-parent.svelte'))
		assert.equal(f.filenames.filter(filename => filename === dependency).length, 2, 'dependency identity must be distinct from the parent block in both builds')
	} finally { await f.cleanup() }
})
