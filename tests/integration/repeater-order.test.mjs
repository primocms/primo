import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../../src/lib/builder/components/Fields/field-entries.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
const module = { exports: {} }
Function('exports', outputText)(module.exports)
const { setFieldEntries } = module.exports
const entry = (id, field, parent, index = 0, value = null) => ({ id, field, parent, index, value, locale: 'en' })
const fields = [
	{ id: 'items', key: 'items', type: 'repeater' },
	{ id: 'name', key: 'name', parent: 'items', type: 'text' },
	{ id: 'links', key: 'links', parent: 'items', type: 'repeater' },
	{ id: 'label', key: 'label', parent: 'links', type: 'text' }
]
function apply(entries, values) {
	const updates = []
	setFieldEntries({
		fields,
		entries,
		values,
		updateEntry(id, data) {
			updates.push({ id, data })
			const item = entries.find((e) => e.id === id)
			Object.assign(item, data)
			return item
		},
		createEntry() {
			throw new Error('Reordering must never create records')
		}
	})
	return updates
}

test('moves with sparse indices preserve all container and descendant identities; subsequent edits follow the moved item', () => {
	const entries = [
		entry('a', 'items', undefined, 0),
		entry('b', 'items', undefined, 2),
		entry('c', 'items', undefined, 5),
		entry('an', 'name', 'a', 0, 'Alpha'),
		entry('bn', 'name', 'b', 0, 'Bravo'),
		entry('cn', 'name', 'c', 0, 'Charlie'),
		entry('a1', 'links', 'a'),
		entry('a1l', 'label', 'a1', 0, 'Nested content')
	]
	const before = structuredClone(entries)
	const updates = apply(entries, { items: { 0: { entryId: 'c' }, 1: { entryId: 'a' }, 2: { entryId: 'b' } } })
	assert.deepEqual(updates, [
		{ id: 'c', data: { index: 0 } },
		{ id: 'a', data: { index: 1 } },
		{ id: 'b', data: { index: 2 } }
	])
	assert.deepEqual(entries.slice(3), before.slice(3))
	assert.deepEqual(
		entries.map(({ index, ...rest }) => rest),
		before.map(({ index, ...rest }) => rest)
	)
	apply(entries, { items: { 0: { value: null, subValues: { name: { 0: { value: 'Charlie edited' } } } } } })
	assert.equal(entries.find((e) => e.id === 'cn').value, 'Charlie edited')
	assert.equal(entries.find((e) => e.id === 'an').value, 'Alpha')
})

test('nested moves remain within their parent and do not change sibling families', () => {
	const entries = [
		entry('a', 'items'),
		entry('b', 'items', undefined, 1),
		entry('a1', 'links', 'a'),
		entry('a2', 'links', 'a', 1),
		entry('b1', 'links', 'b'),
		entry('a1l', 'label', 'a1', 0, 'First'),
		entry('a2l', 'label', 'a2', 0, 'Second')
	]
	const before = structuredClone(entries)
	apply(entries, { items: { 0: { value: null, subValues: { links: { 0: { entryId: 'a2' }, 1: { entryId: 'a1' } } } } } })
	assert.equal(entries.find((e) => e.id === 'a2').index, 0)
	assert.equal(entries.find((e) => e.id === 'a1').index, 1)
	assert.deepEqual(
		entries.filter((e) => !['a1', 'a2'].includes(e.id)),
		before.filter((e) => !['a1', 'a2'].includes(e.id))
	)
})

test('move commands cannot retarget another parent, another field, a missing record, or a text entry', () => {
	const entries = [entry('a', 'items'), entry('b', 'items', undefined, 1), entry('a1', 'links', 'a'), entry('b1', 'links', 'b'), entry('an', 'name', 'a', 0, 'Alpha')]
	const before = structuredClone(entries)
	const updates = apply(entries, { items: { 0: { entryId: 'missing' }, 1: { entryId: 'a1' } } })
	// Normal content creation is separately covered; invalid moves never create.
	assert.deepEqual(updates, [])
	assert.deepEqual(entries, before)
	apply(entries, { items: { 0: { value: null, subValues: { links: { 0: { entryId: 'b1' } }, name: { 1: { entryId: 'an' } } } } } })
	assert.deepEqual(entries, before)
})
