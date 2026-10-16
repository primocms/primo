import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { compile, compileModule } from 'svelte/compiler'
import ts from 'typescript'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../../', import.meta.url))
// Exercise real Svelte components and runtime in Chromium. Icons, unrelated
// pickers and persistence transport are substituted; control/event/state logic
// remains the production implementation.
async function fixture(source, { presence = false, pageData = false, extraMocks = {} } = {}) {
	const mocks = {
		'test:empty.svelte': '<span></span>',
		'test:utilities': 'export const createUniqueID = () => "select-test"; export const clickOutside = () => {};',
		'test:context': 'export const site_context = {get: () => ({value: {page_types: () => []}}), getOr: () => ({value: null})}; export const debugging_context={getOr:()=>false};',
		'test:stores':
			'import {writable} from "svelte/store"; export const mod_key_held=writable(false); export const current_user=writable({siteRole:"developer"}); export const read_only=writable(false);',
		'test:page': 'export const page={url:new URL("http://localhost/admin/site")};',
		'test:environment': 'export const browser=true;',
		'test:tooltip': 'export const Provider=()=>{}, Root=()=>{}, Trigger=()=>{}, Content=()=>{};',
		'test:ui': `import TextInput from ${JSON.stringify(path.join(root, 'src/lib/builder/ui/TextInput.svelte'))}; export default {TextInput};`,
		'test:collections': `globalThis.activityRecords=[]; export const UserActivities={create(value){const record={id:'presence',...value};activityRecords.push(structuredClone(record));return record},update(id,value){const record={id,...value};activityRecords.push(structuredClone(record));return record},delete(){}}; export const Collaborators={},Pages={},PageSections={},PageTypes={},PageTypeSections={},Sites={},SiteSymbols={};`,
		'test:managers': 'export const activity={commit:async()=>{}}; export const self={};',
		'test:instance': 'export const instance={dev_mode:false};',
		'test:pages': 'export const build_cms_page_url=()=>null;',
		...extraMocks,
		'test:wrapper.svelte': source
	}
	const bundled = await build({
		stdin: { contents: 'import {mount} from "svelte";import App from "test:wrapper.svelte";window.subject=mount(App,{target:document.body});', resolveDir: root },
		bundle: true,
		write: false,
		format: 'iife',
		platform: 'browser',
		conditions: ['browser'],
		logLevel: 'silent',
		plugins: [
			{
				name: 'real-svelte-controls',
				setup(b) {
					b.onResolve({ filter: /^\$lib\/builder\/utils\/popper-fix$/ }, () => ({ path: path.join(root, 'src/lib/builder/utils/popper-fix.ts') }))
					b.onResolve({ filter: /^test:/ }, (args) => ({ path: args.path, namespace: 'test' }))
					b.onResolve({ filter: /^@iconify\/svelte$|IconPicker\.svelte$/ }, () => ({ path: 'test:empty.svelte', namespace: 'test' }))
					b.onResolve({ filter: /utilities(?:\.js)?$/ }, () => ({ path: 'test:utilities', namespace: 'test' }))
					b.onResolve({ filter: /stores\/context(?:\.js)?$|^\.\/builder\/stores\/context$/ }, () => ({ path: 'test:context', namespace: 'test' }))
					b.onResolve({ filter: /stores\/app\/misc$|pocketbase\/user$|pocketbase\/author_mode$/ }, () => ({ path: 'test:stores', namespace: 'test' }))
					b.onResolve({ filter: /^\$app\/state$/ }, () => ({ path: 'test:page', namespace: 'test' }))
					b.onResolve({ filter: /^\$app\/environment$/ }, () => ({ path: 'test:environment', namespace: 'test' }))
					b.onResolve({ filter: /^\$lib\/components\/ui\/tooltip$/ }, () => ({ path: 'test:tooltip', namespace: 'test' }))
					b.onResolve({ filter: /^\.\.\/\.\.\/\.\.\/ui\/index\.js$/ }, () => ({ path: 'test:ui', namespace: 'test' }))
					if (pageData) {
						b.onResolve({ filter: /^\.\/pocketbase\/collections$/ }, () => ({ path: 'test:page-collections', namespace: 'test' }))
						b.onResolve({ filter: /^\.\/pocketbase\/managers$/ }, () => ({ path: 'test:managers', namespace: 'test' }))
					}
					if (presence) {
						for (const [pattern, key] of [
							[/^\.\/pocketbase\/collections$/, 'collections'],
							[/^\.\/pocketbase\/managers$/, 'managers'],
							[/^\.\/pocketbase\/user$/, 'stores'],
							[/^\.\/instance$/, 'instance'],
							[/^\.\/pages$/, 'pages']
						])
							b.onResolve({ filter: pattern }, () => ({ path: 'test:' + key, namespace: 'test' }))
					}
					const transform = (contents, filename) => {
						if (filename.endsWith('.svelte')) {
							const result = compile(contents, { filename, generate: 'client', css: 'external', dev: true })
							assert.deepEqual(result.warnings, [], filename + ' compiler warnings')
							return { contents: result.js.code, loader: 'js', resolveDir: filename.startsWith('test:') ? root : path.dirname(filename) }
						}
						if (/\.svelte\.[jt]s$/.test(filename))
							return {
								contents: compileModule(ts.transpileModule(contents, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, {
									filename,
									generate: 'client',
									dev: true
								}).js.code,
								loader: 'js',
								resolveDir: path.dirname(filename)
							}
						return { contents, loader: 'js', resolveDir: root }
					}
					b.onLoad({ filter: /.*/, namespace: 'test' }, (args) => transform(mocks[args.path], args.path))
					b.onLoad({ filter: /\.svelte(?:\.[jt]s)?$/ }, async (args) => transform(await readFile(args.path, 'utf8'), args.path))
				}
			}
		]
	})
	const browser = await chromium.launch({ headless: true })
	const page = await browser.newPage()
	page.setDefaultTimeout(8000)
	const errors = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.setContent('<!doctype html><html><body style="padding:200px"></body></html>')
	await page.addScriptTag({ content: bundled.outputFiles[0].text })
	if (errors.length) {
		await browser.close()
		assert.deepEqual(errors, [])
	}
	return { page, errors, close: () => browser.close() }
}
const component = (relative) => JSON.stringify(path.join(root, relative))

test('select follows changed options, value and live popper placement/width; Escape restores focus', async () => {
	const f = await fixture(
		`<script>import Select from ${component('src/lib/builder/ui/Select.svelte')};let props=$state({options:[{label:'Alpha',value:'a'},{label:'Beta',value:'b'}],value:'a',placement:'bottom-start',fullwidth:false});export function update(next){Object.assign(props,next)}</script><Select {...props}/>`
	)
	try {
		const { page } = f
		await page.getByRole('button', { name: 'Alpha', exact: true }).click()
		await page.waitForSelector('.popup[data-popper-placement="bottom-start"]')
		await page.evaluate(() => subject.update({ value: 'b', options: [{ label: 'Beta updated', value: 'b' }], placement: 'top-start', fullwidth: true }))
		await page.waitForSelector('.popup[data-popper-placement="top-start"]')
		assert.equal(await page.locator('button.primary').innerText(), 'Beta updated')
		const widths = await page.evaluate(() => [document.querySelector('.popup').getBoundingClientRect().width, document.querySelector('button.primary').getBoundingClientRect().width])
		assert.ok(Math.abs(widths[0] - widths[1]) < 1)
		await page.locator('.popup button').focus()
		await page.keyboard.press('Escape')
		await page.waitForSelector('.popup', { state: 'detached' })
		assert.equal(await page.locator('button.primary').evaluate((el) => el === document.activeElement), true)
		assert.deepEqual(f.errors, [])
	} finally {
		await f.close()
	}
})

test('toggle forwards explicit focus/blur callbacks and never captures global handlers', async () => {
	const f = await fixture(
		`<script>import Toggle from ${component('src/lib/builder/ui/Toggle/Toggle.svelte')};let counts=$state({focus:0,blur:0,toggle:0});export function read(){return {...counts}}</script><Toggle label="Enabled" onfocus={()=>counts.focus++} onblur={()=>counts.blur++} on:toggle={()=>counts.toggle++}/><Toggle label="No callbacks"/><button id="outside">Outside</button>`
	)
	try {
		const { page } = f
		await page.evaluate(() => {
			window.globalEvents = 0
			window.onfocus = () => globalEvents++
			window.onblur = () => globalEvents++
		})
		const first = page.getByRole('switch').nth(0)
		await first.focus()
		await first.click()
		await page.locator('#outside').focus()
		assert.deepEqual(await page.evaluate(() => subject.read()), { focus: 1, blur: 1, toggle: 1 })
		await page.getByRole('switch').nth(1).focus()
		await page.locator('#outside').focus()
		assert.equal(await page.evaluate(() => globalEvents), 0)
		assert.deepEqual(f.errors, [])
	} finally {
		await f.close()
	}
})

test('page-type form preserves an unsaved draft when initial props refresh', async () => {
	const f = await fixture(
		`<script>import Form from ${component('src/lib/builder/views/modal/PageTypeModal/PageTypeForm.svelte')};let name=$state('Original');export function refresh(){name='Server refresh'}</script><Form new_page_name={name}/>`
	)
	try {
		const { page } = f
		const input = page.getByLabel('Page Type Name')
		await input.fill('Unsaved client draft')
		await page.evaluate(() => subject.refresh())
		assert.equal(await input.inputValue(), 'Unsaved client draft')
		assert.deepEqual(f.errors, [])
	} finally {
		await f.close()
	}
})

test('block disclosure closes after an action and Escape returns focus to its summary', async () => {
	const f = await fixture(
		`<script>import Toolbar from ${component('src/lib/builder/views/editor/Layout/BlockToolbar.svelte')};let moves=$state(0);export function read(){return moves}</script><Toolbar id="block" i={1} name="Hero" on:moveUp={()=>moves++}/>`
	)
	try {
		const { page } = f
		const summary = page.getByLabel('More block actions')
		await summary.click()
		await page.getByRole('button', { name: 'Move up', exact: true }).focus()
		await page.keyboard.press('Escape')
		assert.equal(await page.locator('details').evaluate((el) => el.open), false)
		assert.equal(await summary.evaluate((el) => el === document.activeElement), true)
		await summary.click()
		await page.getByRole('button', { name: 'Move up', exact: true }).click()
		assert.equal(await page.evaluate(() => subject.read()), 1)
		assert.equal(await page.locator('details').evaluate((el) => el.open), false)
		assert.deepEqual(f.errors, [])
	} finally {
		await f.close()
	}
})

test('presence getter follows navigation and clears old section keys without registering context from an effect', async () => {
	const activity = component('src/lib/UserActivity.svelte.ts')
	// A real nested component exercises the existing-context branch too.
	const child = `<script>import {setUserActivity} from ${activity};let {page}=$props();setUserActivity(()=>page==='first'?{page_section:'first-section'}:{page_type_section:'second-section'});</script><span>Presence child</span>`
	const f = await fixture(
		`<script>import {setUserActivity} from ${activity};import Child from 'test:presence-child.svelte';let site=$state('first');setUserActivity(()=>({user:'user',site}));export function navigate(){site='second'}</script><Child page={site}/>`,
		{ presence: true, extraMocks: { 'test:presence-child.svelte': child } }
	)
	try {
		const { page } = f
		await page.waitForFunction(() => activityRecords.some((r) => r.site === 'first'))
		await page.evaluate(() => subject.navigate())
		await page
			.waitForFunction(() => activityRecords.some((r) => r.site === 'second' && r.page_type_section === 'second-section' && r.page_section === ''))
			.catch(async (error) => {
				throw new Error(error.message + JSON.stringify({ records: await page.evaluate(() => activityRecords), errors: f.errors }))
			})
		assert.deepEqual(f.errors, [])
	} finally {
		await f.close()
	}
})

test('worker status remains reactive through loading, success and failure', async () => {
	const f = await fixture(
		`<script>import {useSvelteWorker} from ${component('src/lib/workers/Worker.svelte.ts')};let loaded=$state(false);const worker=useSvelteWorker(()=>true,()=>loaded,async(value)=>{if(value==='fail')throw new Error('expected');return value+'!'});export function run(value){return worker.run(value)}export function load(){loaded=true}</script><output>{worker.status}</output>`
	)
	try {
		const { page } = f
		await page.waitForFunction(() => document.querySelector('output')?.textContent === 'standby')
		await page.evaluate(() => {
			window.result = subject.run('client')
		})
		await page.waitForFunction(() => document.querySelector('output').textContent === 'loading')
		await page.evaluate(() => subject.load())
		assert.equal(await page.evaluate(() => result), 'client!')
		assert.equal(await page.locator('output').innerText(), 'standby')
		assert.equal(await page.evaluate(() => subject.run('fail').catch((error) => error.message)), 'expected')
		assert.equal(await page.locator('output').innerText(), 'standby')
		assert.deepEqual(f.errors, [])
	} finally {
		await f.close()
	}
})

test('page data getter retains loading and live entry updates', async () => {
	const collections = 'export const Pages={},Sites={},PageTypes={from:()=>({one:()=>undefined})},SiteSymbols={from:()=>({one:()=>undefined})};'
	const f = await fixture(
		`<script>import {usePageData} from ${component('src/lib/PageData.svelte.ts')};let ready=$state(false);let value=$state('Original');const site={uploads:()=>ready?[]:undefined,fields:()=>[],entries:()=>[{id:'entry',value}]};const result=usePageData(site,[]);export function load(){ready=true}export function edit(){value='Client edit'}</script><output>{result.data ? result.data.site_entries[0].value : 'loading'}</output>`,
		{ pageData: true, extraMocks: { 'test:page-collections': collections } }
	)
	try {
		const { page } = f
		assert.equal(await page.locator('output').innerText(), 'loading')
		await page.evaluate(() => subject.load())
		await page.waitForFunction(() => document.querySelector('output').textContent === 'Original')
		await page.evaluate(() => subject.edit())
		await page.waitForFunction(() => document.querySelector('output').textContent === 'Client edit')
		assert.deepEqual(f.errors, [])
	} finally {
		await f.close()
	}
})
