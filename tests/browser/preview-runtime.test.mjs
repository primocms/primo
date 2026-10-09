import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { build } from 'esbuild'
import { compile, compileModule } from 'svelte/compiler'
import { chromium } from '@playwright/test'

const root = new URL('../../', import.meta.url)
const runtime = await readFile(new URL('src/lib/compiler/preview-runtime.svelte.js', root), 'utf8')
const contentDOM = await readFile(new URL('src/lib/builder/views/editor/Layout/content-dom.ts', root), 'utf8')
const helpersSource = await readFile(new URL('src/lib/builder/components/misc.js', root), 'utf8')
const helpers = Function(
	helpersSource
		.replace(/^import .*$/gm, '')
		.replaceAll('export const ', 'const ')
		.replace('const preview_iframe_head', "const PRIMO_BASELINE_CSS = ''; const preview_iframe_head") + '; return { component_iframe_srcdoc, dynamic_iframe_srcdoc };'
)()

async function bundle(version) {
	const component = `<script>
		import {onMount} from 'svelte';
		let {text, image, body, items, optional = 'fallback'} = $props();
		let count = $state(0);
		onMount(() => {window.mounts = (window.mounts || 0) + 1; return () => window.unmounts = (window.unmounts || 0) + 1;});
	</script>
	<h1>{text}</h1><img src={image.url} alt={image.alt} />
	<div class="body">{@html body}</div>
	<ul>{#each items as item}<li>{item.label}</li>{/each}</ul>
	<p>{optional}</p><button onclick={() => count++}>{count}</button><footer>${version}</footer>`
	const result = await build({
		stdin: {
			contents: `export {default} from 'test-component'; export {createPreview} from 'test-runtime'; import * as adapter from 'test-content-dom'; window.adapter = adapter;`,
			resolveDir: root.pathname
		},
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'browser',
		conditions: ['browser'],
		plugins: [
			{
				name: 'preview-test',
				setup(b) {
					b.onResolve({ filter: /^test-(component|runtime|content-dom)$/ }, (args) => ({ path: args.path, namespace: 'test' }))
					b.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
						contents:
							args.path === 'test-content-dom'
								? contentDOM
								: args.path === 'test-component'
									? compile(component, { generate: 'client', runes: true }).js.code
									: compileModule(runtime, { generate: 'client' }).js.code,
						loader: args.path === 'test-content-dom' ? 'ts' : 'js',
						resolveDir: root.pathname
					}))
				}
			}
		]
	})
	return result.outputFiles[0].text
}

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7XQAAAAASUVORK5CYII='
const initial = {
	text: 'Before',
	image: { url: image, alt: 'Before' },
	body: `<p>Body</p><img src="${image}" alt="embedded" />`,
	items: [{ label: 'First' }, { label: 'Second' }],
	optional: 'present'
}

for (const kind of ['component', 'dynamic']) {
	test(`${kind} preview preserves images and component state during content saves`, async () => {
		const browser = await chromium.launch({ headless: true })
		try {
			const page = await browser.newPage()
			const errors = []
			page.on('pageerror', (error) => errors.push(error.message))
			await page.setContent('<iframe></iframe>')
			await page.evaluate(() => {
				window.channel = new BroadcastChannel('preview-test')
			})
			const html = kind === 'component' ? helpers.component_iframe_srcdoc({}) : helpers.dynamic_iframe_srcdoc('', 'preview-test')
			await page.locator('iframe').evaluate((el, html) => {
				el.srcdoc = html
			}, html)
			const frame = page.frames()[1]
			await frame.waitForFunction(() => window.__PRIMO_CONTEXT__?.environment === 'editor' && document.readyState === 'complete')
			const source = await bundle('v1')
			const send = (data, js = source) =>
				page.evaluate(
					({ kind, js, data }) => {
						if (kind === 'component') document.querySelector('iframe').contentWindow.postMessage({ payload: { js, data } }, '*')
						else window.channel.postMessage({ payload: { componentApp: js, data } })
					},
					{ kind, js, data }
				)
			await send(initial)
			await frame.waitForFunction(() => document.querySelector('h1')?.textContent === 'Before' && [...document.images].every((img) => img.complete))
			await frame.evaluate(() => {
				const heading = document.querySelector('h1')
				heading.contentEditable = 'true'
				window.adapter.rememberTextDOM(heading)
			})
			await frame.locator('h1').click()
			await page.keyboard.press('ControlOrMeta+A')
			await page.keyboard.press('Backspace')
			await page.keyboard.type('Before')
			await frame.evaluate(() => window.adapter.restoreTextDOM(document.querySelector('h1')))
			await send(initial)
			assert.equal(await frame.locator('h1').textContent(), 'Before')
			await frame.evaluate(() => {
				window.originalImages = [...document.images]
				window.loads = 0
				document.addEventListener(
					'load',
					(event) => {
						if (event.target.tagName === 'IMG') window.loads++
					},
					true
				)
			})
			await frame.locator('button').click()
			await send({ ...initial, text: 'After' })
			await frame.waitForFunction(() => document.querySelector('h1')?.textContent === 'After')
			assert.deepEqual(
				await frame.evaluate(() => ({
					imagesRetained: window.originalImages.every((img, index) => img === document.images[index] && img.isConnected),
					mounts: window.mounts,
					unmounts: window.unmounts || 0,
					loads: window.loads,
					count: document.querySelector('button').textContent
				})),
				{ imagesRetained: true, mounts: 1, unmounts: 0, loads: 0, count: '1' }
			)

			// Data-only messages, nested values, removed props, and repeaters still update.
			const next = { ...initial, text: 'Latest', image: { url: image, alt: 'Edited alt' }, items: [{ label: 'Second' }, { label: 'First' }, { label: 'Third' }] }
			delete next.optional
			await send(next, null)
			await frame.waitForFunction(() => document.querySelector('h1')?.textContent === 'Latest')
			assert.equal(await frame.locator('img').first().getAttribute('alt'), 'Edited alt')
			assert.deepEqual(await frame.locator('li').allTextContents(), ['Second', 'First', 'Third'])
			assert.equal(await frame.locator('body > p, #component > p').textContent(), 'fallback')
			assert.equal(await frame.evaluate(() => window.originalImages.every((img, index) => img === document.images[index])), true)

			// A genuine image change updates src on the existing element.
			await send({ ...next, image: { url: image + '#changed', alt: 'Changed image' } })
			await frame.waitForFunction(() => document.images[0].alt === 'Changed image' && document.images[0].complete)
			assert.equal(await frame.evaluate(() => window.originalImages[0] === document.images[0]), true)
			assert.equal(await frame.locator('img').first().getAttribute('src'), image + '#changed')

			// The real editor adapter retains Svelte's HTML anchors off-document;
			// changes to backing HTML must leave the visible editing surface intact.
			await frame.evaluate(() => {
				const body = document.querySelector('.body')
				const anchor = body.lastChild
				window.surface = window.adapter.createRichTextSurface(body)
					window.surface.textContent = 'Visible editor content'
					window.backingSource = anchor.parentNode
					document.addEventListener('primo-rendered', () => {
						const source = window.adapter.restoreRichTextSurface(body, window.surface)
						if (source) window.backingSource = source
					})
			})
			await send({ ...next, body: '<p>Updated backing content</p>' })
			await frame.waitForFunction(() => window.backingSource.textContent === 'Updated backing content')
			assert.equal(await frame.locator('.body').textContent(), 'Visible editor content')
			assert.equal(await frame.evaluate(() => window.surface.isConnected), true)

			// Code changes remount, resetting local state and disposing the old instance.
			await send(next, await bundle('v2'))
			await frame.waitForFunction(() => document.querySelector('footer')?.textContent === 'v2')
			assert.deepEqual(
				await frame.evaluate(() => ({
					mounts: window.mounts,
					unmounts: window.unmounts,
					count: document.querySelector('button').textContent,
					oldImageConnected: window.originalImages[0].isConnected
				})),
				{ mounts: 2, unmounts: 1, count: '0', oldImageConnected: false }
			)
			assert.deepEqual(errors, [])
		} finally {
			await browser.close()
		}
	})
}
