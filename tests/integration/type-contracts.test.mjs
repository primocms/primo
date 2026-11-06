import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'
import { compile } from 'svelte/compiler'
import { render } from 'svelte/server'

const require = createRequire(import.meta.url)
async function loadTS(relative) {
	const source = await readFile(new URL(`../../${relative}`, import.meta.url), 'utf8')
	const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
	const module = { exports: {} }
	Function('require', 'module', 'exports', outputText)(require, module, module.exports)
	return module.exports
}
const { FieldBase } = await loadTS('src/lib/common/models/FieldBase.ts')
const { Symbol } = await loadTS('src/lib/common/models/Symbol.ts')
const { Page } = await loadTS('src/lib/common/models/Page.ts')
const { OrderedSvelteMap } = await loadTS('src/lib/pocketbase/OrderedSvelteMap.ts')

test('unnamed fields normalize to editable strings without changing identity or nested configuration', () => {
	const input = { id: 'field', type: 'text', index: 2, parent: 'group', config: { condition: { field: 'other', value: 0 } } }
	const parsed = FieldBase.parse(input)
	assert.deepEqual(parsed, { ...input, key: '', label: '' })
	assert.deepEqual(input, { id: 'field', type: 'text', index: 2, parent: 'group', config: { condition: { field: 'other', value: 0 } } })
})

test('explicit field labels/keys and unnamed block source survive model parsing', () => {
	const field = { id: 'field', type: 'text', index: 0, key: 'headline', label: 'Título', config: null }
	assert.deepEqual(FieldBase.parse(field), field)
	const block = { id: 'block', html: '<h1>Keep</h1>', css: 'h1{color:red}', js: 'let count=0' }
	assert.deepEqual(Symbol.parse(block), { ...block, name: '' })
	assert.equal(Symbol.parse({ ...block, name: 'Client hero' }).name, 'Client hero')
})

test('page creation metadata survives parsing for content created_at while older records remain accepted', () => {
	const page = { id: 'page', name: 'About', slug: 'about', page_type: 'default', parent: 'home', site: 'site', index: 1 }
	assert.deepEqual(Page.parse(page), page)
	assert.deepEqual(Page.parse({ ...page, created: '2026-10-15T12:00:00Z' }), { ...page, created: '2026-10-15T12:00:00Z' })
})

test('ordered reactive-map iterators retain insertion order across updates, deletion and reinsertion', () => {
	const map = new OrderedSvelteMap()
	map.set('a', 1).set('b', 2).set('a', 3)
	assert.deepEqual(
		[...map],
		[
			['a', 3],
			['b', 2]
		]
	)
	assert.deepEqual([...map.keys()], ['a', 'b'])
	assert.deepEqual([...map.values()], [3, 2])
	map.delete('a')
	map.set('a', 4)
	assert.deepEqual(
		[...map.entries()],
		[
			['b', 2],
			['a', 4]
		]
	)
	const iterator = map.entries()
	iterator.next()
	iterator.next()
	assert.deepEqual(iterator.next(), { done: true, value: undefined })
	map.clear()
	assert.deepEqual([...map], [])
})

test('ordered reactive-map callbacks retain falsey values and map identity', () => {
	const map = new OrderedSvelteMap()
	map.set('zero', 0).set('empty', undefined)
	const calls = []
	map.forEach((value, key, owner) => calls.push({ value, key, same: owner === map }))
	assert.deepEqual(calls, [
		{ value: 0, key: 'zero', same: true },
		{ value: undefined, key: 'empty', same: true }
	])
	assert.equal(map.has('empty'), true)
})

// Compile and render the real switch. Only icon painting and the keyboard
// store are substituted; the actual Svelte prop defaults and class logic run.
let switchSource = await readFile(new URL('../../src/lib/builder/ui/LargeSwitch.svelte', import.meta.url), 'utf8')
switchSource = switchSource
	.replace("import Icon from '@iconify/svelte'", 'const Icon = () => {}')
	.replace("import { mod_key_held } from '../stores/app/misc'", "import { writable } from 'svelte/store'; const mod_key_held = writable(false)")
const switchCode = compile(switchSource, { generate: 'server', filename: 'LargeSwitch.svelte' }).js.code.replace(
	/from (['"])(svelte(?:\/[^'"]+)?)\1/g,
	(_match, _quote, name) => `from '${pathToFileURL(require.resolve(name)).href}'`
)
const { default: LargeSwitch } = await import('data:text/javascript;base64,' + Buffer.from(switchCode).toString('base64'))
for (const [label, props, active] of [
	['default', {}, 0],
	['explicit content', { active_tab_id: 'content' }, 1]
]) {
	test(`code/content switch renders ${label} state without referencing removed tabs`, () => {
		const { body } = render(LargeSwitch, { props })
		const halves = [...body.matchAll(/class="(half[^\"]*)"/g)].map((match) => match[1].split(' '))
		assert.equal(halves.length, 2)
		assert.equal(halves[active].includes('active'), true)
		assert.equal(halves[1 - active].includes('active'), false)
	})
}

test('page compilation without an explicit head supplies empty head props and retains component data', async () => {
	const source = await readFile(new URL('../../src/lib/compiler/processors.js', import.meta.url), 'utf8')
	const requests = []
	class PromiseWorker {
		async postMessage(input) {
			requests.push(input)
			return { ssr: 'unused fake worker output', dom: '' }
		}
	}
	const scope = {
		createCompilerClient: (await import('../../src/lib/compiler/worker-client.js')).createCompilerClient,
		PromiseWorker,
		rollupWorker: class {},
		postCSSWorker: class {},
		_: require('lodash-es'),
		Blob,
		URL: { createObjectURL: () => 'data:text/javascript,export default function(){};export function render(app,{props}){return {head:JSON.stringify(props),body:%22Rendered%22}}', revokeObjectURL() {} }
	}
	const code = source.replace(/^import .*$/gm, '').replace(/^export /gm, '')
	const html = Function(...Object.keys(scope), code + '\nreturn html')(...Object.values(scope))
	const result = await html({ component: [{ html: '<h1>{title}</h1>', js: '', css: '', data: { title: 'Kept' } }] })
	assert.equal(result.body, 'Rendered')
	assert.deepEqual(requests[0].head, { code: '', data: {} })
	assert.deepEqual(JSON.parse(result.head), { component_0_props: { title: 'Kept' }, head_props: {} })
})
