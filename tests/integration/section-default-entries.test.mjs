import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../../src/lib/builder/views/modal/SectionEditor/copy-field-entries.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
const module = { exports: {} }
Function('exports', outputText)(module.exports)
const { copy_new_field_entries } = module.exports
const entry = (id, field, parent, value = null, index = 0, locale = 'en') => ({ id, field, parent, value, index, locale })

function copy(entries, field_ids, symbol_entries = []) {
	const created = []
	copy_new_field_entries({
		entries,
		field_ids: new Set(field_ids),
		symbol_entries,
		create_entry(data) {
			const result = { ...data, id: `symbol-${created.length}` }
			created.push(result)
			return result
		}
	})
	return created
}

test('new repeater/group defaults retain nested values, locales, empty items and remapped parents', () => {
	const entries = [
		entry('title', 'title-field', 'group', 'First item'),
		entry('group', 'group-field', 'item'),
		entry('blank', 'items-field', undefined, null, 1),
		entry('item', 'items-field'),
		entry('translated-item', 'items-field', undefined, null, 0, 'fr'),
		entry('translated-title', 'title-field', 'translated-item', 'Bonjour', 0, 'fr'),
		entry('unrelated', 'old-field', undefined, 'Keep section-only')
	]
	const before = structuredClone(entries)
	const created = copy(entries, ['items-field', 'group-field', 'title-field'])
	assert.equal(created.length, 6)
	const first = created.find((e) => e.field === 'items-field' && e.index === 0 && e.locale === 'en')
	const group = created.find((e) => e.field === 'group-field')
	assert.equal(group.parent, first.id)
	assert.equal(created.find((e) => e.value === 'First item').parent, group.id)
	assert.equal(created.find((e) => e.value === 'Bonjour').parent, created.find((e) => e.field === 'items-field' && e.locale === 'fr').id)
	assert.ok(created.some((e) => e.field === 'items-field' && e.index === 1))
	assert.deepEqual(entries, before)
	assert.equal(copy(entries, ['items-field', 'group-field', 'title-field'], created).length, 0, 'retrying must not duplicate defaults')
})

test('new nested fields reuse existing default parents without overwriting their content', () => {
	const entries = [entry('local-group', 'group-field'), entry('new-title', 'new-field', 'local-group', 'New default')]
	const existing = [entry('default-group', 'group-field', undefined, { keep: true }), entry('old-value', 'old-field', 'default-group', 'Existing default')]
	const created = copy(entries, ['new-field'], existing)
	assert.equal(created.length, 1)
	assert.equal(created[0].parent, 'default-group')
	assert.equal(created[0].value, 'New default')
	assert.deepEqual(existing[0].value, { keep: true })
	assert.equal(existing[1].value, 'Existing default')
})

test('new nested fields create missing parent containers without copying unrelated siblings', () => {
	const created = copy([entry('parent', 'old-group'), entry('new', 'new-field', 'parent', 'New'), entry('old', 'old-field', 'parent', 'Section-only')], ['new-field'])
	assert.equal(created.length, 2)
	assert.equal(created[1].parent, created[0].id)
	assert.equal(created[1].value, 'New')
})

test('malformed parents cannot create defaults referencing another collection', () => {
	assert.throws(() => copy([entry('orphan', 'new-field', 'missing')], ['new-field']), /without its parent/)
	assert.throws(() => copy([entry('a', 'new-field', 'b'), entry('b', 'group-field', 'a')], ['new-field']), /cyclic/)
})
