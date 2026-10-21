import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { build } from 'esbuild'
import { compile, compileModule } from 'svelte/compiler'
import { chromium } from '@playwright/test'

const root = new URL('../../', import.meta.url)
const component = await readFile(new URL('src/lib/builder/components/PreviewHead.svelte', root), 'utf8')
const modalPreview = await readFile(new URL('src/lib/builder/components/ComponentPreview.svelte', root), 'utf8')
const baseline = await readFile(new URL('src/lib/common/baseline-css.ts', root), 'utf8')
const helpers = (await readFile(new URL('src/lib/builder/components/misc.js', root), 'utf8'))
	.replace("import { VERSION as SVELTE_VERSION } from 'svelte/compiler'", "const SVELTE_VERSION = 'test'")
	.replace("import { PRIMO_BASELINE_CSS } from '$lib/common/baseline-css'", baseline)

// Exercise the real reactive head component with controlled records and routes.
// The compiler bridge below renders actual Svelte head code on the Node side.
const stateModule = `
	import { writable } from 'svelte/store';
	export const state = $state(window.initial);
	export const locale = writable('en');
	export const site_html = writable(null);
	export const highlightedElement = writable(null);
	export const current_user = writable(null);
	export const browser = true;
	export const content_editable = () => ({});
	export const onModKey = () => {};
	export const processCSS = async (css) => css;
	export const page = { get params() { return state.params; } };
	export const PageTypes = { one: (id) => state.types[id] };
	export const resolve_page = (_site, path) => state.pages[path.join('/')];
	export const useContent = (entity) => state.content[entity.id];
	export const calls = [];
	export function processCode(input) {
		if (input.buildStatic === false) return Promise.resolve({ js: ${JSON.stringify(`export default {}; export function createPreview(_App, {target, props}) { const update = p => target.innerHTML = '<p>' + p.text + '</p>'; update(props); return {update, destroy() {target.innerHTML = ''}}; }`)} });
		const call = { input };
		calls.push(call);
		if (!window.deferCompiles) return window.compileHead(input);
		return new Promise((resolve, reject) => {
			call.resolve = async () => resolve(await window.compileHead(input));
			call.reject = reject;
		});
	}
`
const markup = `<header class="cdfi-home-header"><a class="brand" href="/"><strong>CDFI</strong></a></header>`
const fixture = `<script>
	import PreviewHead from 'preview-head';
	import ComponentPreview from 'modal-preview';
	import { state, site_html } from 'fixture-state';
	import { component_iframe_srcdoc, dynamic_iframe_srcdoc, static_iframe_srcdoc } from 'iframe-helpers';
	const site = $derived({ ...state.site, homepage: () => state.pages.home });
	const markup = ${JSON.stringify(markup)};
	const css = '<style>.brand strong {font:800 1.55rem var(--theme-body-font),sans-serif;color:var(--color-heading)}</style>';
</script>
<PreviewHead {site} />
{#if $site_html !== null}
	<iframe title="canvas" srcdoc={component_iframe_srcdoc({head:$site_html+css}).replace('<div id="component"></div>', markup)}></iframe>
	<iframe title="modal" srcdoc={dynamic_iframe_srcdoc($site_html+css,'head-test').replace('<body>', '<body>'+markup)}></iframe>
	<iframe title="sidebar" srcdoc={static_iframe_srcdoc({head:$site_html+css,html:markup,css:''})}></iframe>
{/if}
{#if state.showModalPreview}<ComponentPreview id="real-modal" hideControls={true} data={{text:'Preview content'}} code={{html:'<p>{text}</p>',css:'',js:''}} />{/if}`

const entry = `
	import { mount, unmount } from 'svelte';
	import Fixture from 'fixture';
	import { state, locale, site_html, calls } from 'fixture-state';
	const app = mount(Fixture, { target: document.body });
	window.fixture = { state, locale, site_html, calls, destroy: () => unmount(app) };
`

const bundle = await build({
	stdin: { contents: entry, resolveDir: root.pathname },
	bundle: true,
	write: false,
	format: 'iife',
	platform: 'browser',
	conditions: ['browser'],
	plugins: [
		{
			name: 'preview-head-fixture',
			setup(b) {
				b.onResolve({ filter: /^(preview-head|modal-preview|fixture|fixture-state|iframe-helpers)$/ }, ({ path }) => ({ path, namespace: 'fixture' }))
				b.onResolve({ filter: /^\$lib\/builder\/stores\/app\/page\.js$/, namespace: 'fixture' }, () => ({ path: 'fixture-state', namespace: 'fixture' }))
				b.onResolve({ filter: /^\.\/misc\.js$/, namespace: 'fixture' }, () => ({ path: 'iframe-helpers', namespace: 'fixture' }))
				b.onResolve({ filter: /^(@iconify\/svelte|svelte-inspect-value)$/, namespace: 'fixture' }, () => ({ path: 'empty-component', namespace: 'fixture' }))
				b.onResolve(
					{
						filter: /^(\$app\/(state|environment)|\$lib\/(pocketbase\/(collections|user)|pages|Content\.svelte|builder\/utils(\/keyboard)?)|\.\.\/(stores\/app\/(misc|page)|utils|utilities))$/,
						namespace: 'fixture'
					},
					() => ({
						path: 'fixture-state',
						namespace: 'fixture'
					})
				)
				b.onLoad({ filter: /\.svelte\.js$/, namespace: 'file' }, async ({ path }) => ({
					contents: compileModule(await readFile(path, 'utf8'), { generate: 'client' }).js.code,
					resolveDir: new URL('.', 'file://' + path).pathname
				}))
				b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
					contents:
						path === 'empty-component'
							? compile('<script>let {children} = $props()</script>{@render children?.()}', { generate: 'client' }).js.code +
								'\nexport const InspectOptionsProvider = () => {}; export const Inspect = {Values: () => {}};'
							: path === 'fixture-state'
								? compileModule(stateModule, { generate: 'client' }).js.code
								: path === 'iframe-helpers'
									? helpers
									: compile(path === 'preview-head' ? component : path === 'modal-preview' ? modalPreview : fixture, { generate: 'client', runes: true, filename: `${path}.svelte` }).js.code,
					resolveDir: root.pathname
				}))
			}
		}
	]
})

async function compileHead({ component: { html, data } }) {
	const source = `<script>let { ${Object.keys(data).join(', ')} } = $props()</script>${html}`
	try {
		const app = compile(source, { generate: 'server', css: 'injected', runes: true }).js.code
		const result = await build({
			stdin: { contents: `import {render} from 'svelte/server'; import App from 'head-app'; export const head = render(App,{props:${JSON.stringify(data)}}).head;`, resolveDir: root.pathname },
			bundle: true,
			write: false,
			format: 'esm',
			platform: 'node',
			plugins: [
				{
					name: 'head-app',
					setup(b) {
						b.onResolve({ filter: /^head-app$/ }, () => ({ path: 'head-app', namespace: 'head' }))
						b.onLoad({ filter: /.*/, namespace: 'head' }, () => ({ contents: app, resolveDir: root.pathname }))
					}
				}
			]
		})
		const { head } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
		return { head }
	} catch (error) {
		return { error: error.message }
	}
}

const siteHead = `<meta name="site-name" content={site_name}><style>:root {--color-heading:red} a {text-decoration:underline}</style>`
const typeHead = `<title>{seo_title}</title><style>:root {--theme-body-font:monospace;--color-heading:rgb(32,61,52)} a {text-decoration:none} body {padding:24px}</style>`
function initialState() {
	return {
		params: {},
		site: { id: 'site', head: siteHead },
		pages: { home: { id: 'home', page_type: 'homepage' }, about: { id: 'about', page_type: 'standard' } },
		types: { homepage: { id: 'homepage', head: typeHead }, standard: { id: 'standard', head: '<title>{seo_title}</title><style>:root {--color-heading:blue}</style>' } },
		content: {
			site: { en: { site_name: 'CDFI', seo_title: 'Site title' }, fr: { site_name: 'CDFI FR', seo_title: 'Site FR' } },
			home: { en: { seo_title: 'Home' }, fr: { seo_title: 'Accueil' } },
			about: { en: { seo_title: 'About' } },
			homepage: { en: { seo_title: 'Default home' } },
			standard: { en: { seo_title: 'Default standard' } }
		}
	}
}

let browser
before(async () => {
	browser = await chromium.launch({ headless: true })
})
after(async () => {
	await browser?.close()
})
async function start(t, initial = initialState(), defer = false) {
	const page = await browser.newPage({ viewport: { width: 1200, height: 600 } })
	t.after(() => page.close())
	page.on('pageerror', (error) => {
		throw error
	})
	await page.exposeFunction('compileHead', compileHead)
	await page.route('http://preview-head.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
	await page.goto('http://preview-head.test/')
	await page.evaluate(
		({ initial, defer }) => {
			window.initial = initial
			window.deferCompiles = defer
		},
		{ initial, defer }
	)
	await page.addScriptTag({ content: bundle.outputFiles[0].text })
	return page
}
async function waitForTitle(page, title) {
	await page.waitForFunction((title) => [...document.querySelectorAll('iframe')].length === 3 && [...document.querySelectorAll('iframe')].every((f) => f.contentDocument?.title === title), title)
}

test('canvas, modal and sidebar receive site plus page-type styles and page content', async (t) => {
	const page = await start(t)
	await waitForTitle(page, 'Home')
	const styles = await page.locator('iframe').evaluateAll((frames) =>
		frames.map((f) => {
			const d = f.contentDocument,
				w = f.contentWindow,
				a = d.querySelector('a'),
				strong = d.querySelector('strong')
			return {
				decoration: w.getComputedStyle(a).textDecorationLine,
				font: w.getComputedStyle(strong).fontFamily,
				size: w.getComputedStyle(strong).fontSize,
				color: w.getComputedStyle(strong).color,
				padding: w.getComputedStyle(d.body).padding,
				site: d.querySelector('meta[name="site-name"]').content
			}
		})
	)
	assert.equal(styles.length, 3)
	for (const style of styles) assert.deepEqual(style, { decoration: 'none', font: 'monospace, sans-serif', size: '24.8px', color: 'rgb(32, 61, 52)', padding: '24px', site: 'CDFI' })
	assert.equal(await page.evaluate(() => window.fixture.calls.length), 1)
})

test('head code, site/page content and locale changes refresh every preview', async (t) => {
	const page = await start(t)
	await waitForTitle(page, 'Home')
	await page.evaluate(() => {
		window.fixture.state.content.home.en.seo_title = 'Edited home'
	})
	await waitForTitle(page, 'Edited home')
	await page.evaluate(() => {
		window.fixture.state.site.head += '<meta name="updated" content={site_name}>'
		window.fixture.state.content.site.en.site_name = 'Updated CDFI'
	})
	await page.waitForFunction(() => [...document.querySelectorAll('iframe')].every((f) => f.contentDocument?.querySelector('meta[name="updated"]')?.content === 'Updated CDFI'))
	await page.evaluate(() => {
		window.fixture.state.types.homepage.head = window.fixture.state.types.homepage.head.replace('{seo_title}', '{seo_title + "!"}')
	})
	await waitForTitle(page, 'Edited home!')
	await page.evaluate(() => window.fixture.locale.set('fr'))
	await waitForTitle(page, 'Accueil!')
	assert.equal(await page.locator('iframe[title="canvas"]').evaluate((f) => f.contentDocument.querySelector('meta[name="site-name"]').content), 'CDFI FR')
})

test('navigation selects the new page/type and the type editor uses default content', async (t) => {
	const page = await start(t)
	await waitForTitle(page, 'Home')
	await page.evaluate(() => {
		window.fixture.state.params = { site_id: 'site', page: 'about' }
	})
	await waitForTitle(page, 'About')
	assert.equal(await page.locator('iframe[title="canvas"]').evaluate((f) => f.contentWindow.getComputedStyle(f.contentDocument.documentElement).getPropertyValue('--color-heading')), 'blue')
	await page.evaluate(() => {
		window.fixture.state.params = { page_type: 'homepage' }
	})
	await waitForTitle(page, 'Default home')
	await page.evaluate(() => {
		window.fixture.state.params = {}
	})
	await waitForTitle(page, 'Home')
	// Types without head code still get the site head, including sites with no homepage.
	await page.evaluate(() => {
		window.fixture.state.types.homepage.head = ''
	})
	await page.waitForFunction(
		() => document.querySelector('iframe')?.contentDocument?.querySelector('meta[name="site-name"]')?.content === 'CDFI' && document.querySelector('iframe').contentDocument.title === ''
	)
	await page.evaluate(() => {
		delete window.fixture.state.pages.home
	})
	await page.waitForFunction(() => window.fixture.calls.length === 6)
})

test('waits for page/type content and ignores obsolete compiles and failures', async (t) => {
	const initial = initialState()
	delete initial.content.home
	const page = await start(t, initial, true)
	assert.equal(await page.evaluate(() => window.fixture.calls.length), 0)
	await page.evaluate(() => {
		window.fixture.state.content.home = { en: { seo_title: 'Home' } }
	})
	await page.waitForFunction(() => window.fixture.calls.length === 1)
	await page.evaluate(() => {
		window.fixture.state.params = { page: 'about' }
	})
	await page.waitForFunction(() => window.fixture.calls.length === 2)
	await page.evaluate(() => window.fixture.calls[1].resolve())
	await waitForTitle(page, 'About')
	await page.evaluate(() => window.fixture.calls[0].reject(new Error('obsolete compile')))
	await waitForTitle(page, 'About')
	await page.evaluate(() => {
		window.fixture.state.params = {}
	})
	await page.waitForFunction(() => window.fixture.calls.length === 3)
	await page.evaluate(() => {
		window.fixture.state.content.home.en.seo_title = 'Latest home'
	})
	await page.waitForFunction(() => window.fixture.calls.length === 4)
	await page.evaluate(() => window.fixture.calls[3].resolve())
	await waitForTitle(page, 'Latest home')
	await page.evaluate(() => window.fixture.calls[2].resolve())
	await waitForTitle(page, 'Latest home')
	await page.evaluate(() => {
		window.fixture.state.content.home.en.seo_title = 'After destroy'
	})
	await page.waitForFunction(() => window.fixture.calls.length === 5)
	await page.evaluate(() => window.fixture.destroy())
	await page.evaluate(() => window.fixture.calls[4].resolve())
	assert.equal(
		await page.evaluate(async () => {
			let value
			const unsubscribe = window.fixture.site_html.subscribe((v) => (value = v))
			unsubscribe()
			return value
		}),
		null
	)
})

test('invalid head code can recover and pending content cancels the previous compile', async (t) => {
	const page = await start(t)
	await waitForTitle(page, 'Home')
	await page.evaluate(() => {
		window.fixture.state.types.homepage.head = '<title>{broken syntax}</title>'
	})
	await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.title === '')
	await page.evaluate(() => {
		window.fixture.state.types.homepage.head = '<title>{seo_title}</title>'
	})
	await waitForTitle(page, 'Home')
	await page.evaluate(() => {
		window.deferCompiles = true
		window.fixture.state.content.home.en.seo_title = 'Old content'
	})
	await page.waitForFunction(() => window.fixture.calls.length === 4)
	await page.evaluate(() => {
		delete window.fixture.state.types.homepage
	})
	await page.waitForFunction(() => document.querySelectorAll('iframe').length === 0)
	await page.evaluate(() => window.fixture.calls[3].resolve())
	assert.equal(await page.locator('iframe').count(), 0)
	await page.evaluate(() => {
		window.deferCompiles = false
		window.fixture.state.types.homepage = { id: 'homepage', head: '<title>{seo_title}</title>' }
	})
	await waitForTitle(page, 'Old content')
})

test('the block editing modal remounts its app when inherited head changes reload its iframe', async (t) => {
	const page = await start(t)
	await waitForTitle(page, 'Home')
	await page.evaluate(() => {
		window.fixture.state.showModalPreview = true
	})
	const preview = page.frameLocator('iframe[title="Preview HTML"]')
	await preview.getByText('Preview content').waitFor({ timeout: 5000 })
	await page.evaluate(() => {
		window.fixture.state.content.home.en.seo_title = 'New head'
	})
	await page.waitForFunction(() => document.querySelector('iframe[title="Preview HTML"]')?.contentDocument?.title === 'New head', undefined, { timeout: 5000 })
	await preview.getByText('Preview content').waitFor({ timeout: 3000 })
})
