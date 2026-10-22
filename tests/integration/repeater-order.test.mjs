import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEntryReordering, orderKey } from '../../src/lib/pocketbase/entry-reordering.js'

const scope = { collection: 'page_section_entries', owner: 'section', ownerKey: 'section', field: 'items', parent: '', locale: 'en' }
function draft() {
	return createEntryReordering({ pending: new Map(), indices: new Map(), errors: new Map() })
}

test('repeated moves keep the original conflict baseline and track new/deleted items', () => {
	const order = draft()
	order.stage(scope, ['c', 'a', 'b'], { a: 0, b: 3, c: 8 })
	order.stage(scope, ['b', 'c', 'a'], { a: 1, b: 2, c: 0 })
	assert.deepEqual(order.pending.get(orderKey(scope)).expected, { b: 3, c: 8, a: 0 })
	order.created(scope.collection, { id: 'd', field: 'items', section: 'section', locale: 'en', index: 3 })
	order.created(scope.collection, { id: 'foreign', field: 'items', section: 'elsewhere', locale: 'en', index: 3 })
	order.deleted('c')
	assert.deepEqual(
		[...order.indices],
		[
			['b', 0],
			['a', 1],
			['d', 2]
		]
	)
	assert.deepEqual(order.pending.get(orderKey(scope)).expected, { b: 3, a: 0, d: 9 })
})

test('failed saving keeps the order retryable; successful saving clears only the order overlay', async () => {
	const order = draft()
	const records = new Map([['a', { data: { id: 'a', index: 0 } }]])
	const changes = new Map([['a', { operation: 'update', committed: true, data: { index: 0, value: 'edited' } }]])
	order.stage(scope, ['b', 'a'], { a: 0, b: 1 })
	await assert.rejects(
		order.commit(
			{
				send: async () => {
					throw new Error('offline')
				}
			},
			records,
			changes
		)
	)
	assert.equal(order.indices.get('a'), 1)
	assert.match(order.errors.get(orderKey(scope)), /could not be saved/)
	await order.commit(
		{
			send: async () => ({
				items: [
					{ id: 'b', index: 0 },
					{ id: 'a', index: 1 }
				]
			})
		},
		records,
		changes
	)
	assert.equal(order.pending.size, 0)
	assert.equal(order.indices.size, 0)
	assert.equal(changes.get('a').data.index, 1)
	assert.equal(changes.get('a').data.value, 'edited')
})

test('a move arriving during a save is retained with the newly confirmed baseline', async () => {
	const order = draft()
	order.stage(scope, ['b', 'a', 'c'], { a: 0, b: 1, c: 2 })
	let finish
	const saving = order.commit(
		{
			send: () =>
				new Promise((resolve) => {
					finish = resolve
				})
		},
		new Map(),
		new Map()
	)
	order.stage(scope, ['c', 'b', 'a'], { a: 0, b: 1, c: 2 })
	finish({
		items: [
			{ id: 'b', index: 0 },
			{ id: 'a', index: 1 },
			{ id: 'c', index: 2 }
		]
	})
	await saving
	assert.deepEqual(order.pending.get(orderKey(scope)).ids, ['c', 'b', 'a'])
	assert.deepEqual(order.pending.get(orderKey(scope)).expected, { a: 1, b: 0, c: 2 })
	assert.deepEqual(
		[...order.indices],
		[
			['c', 0],
			['b', 1],
			['a', 2]
		]
	)
})

test('conflicts stay visible and discard removes all order drafts', async () => {
	const order = draft()
	order.stage(scope, ['b', 'a'], { a: 0, b: 1 })
	await assert.rejects(
		order.commit(
			{
				send: async () => {
					throw { status: 409 }
				}
			},
			new Map(),
			new Map()
		)
	)
	assert.match(order.errors.get(orderKey(scope)), /changed elsewhere/)
	order.discard()
	assert.equal(order.pending.size + order.indices.size + order.errors.size, 0)
})

test('deleting a parent or field discards its nested order drafts', () => {
	const order = draft()
	order.stage({ ...scope, parent: 'parent' }, ['a', 'b'], { a: 0, b: 1 })
	order.deleted('parent')
	assert.equal(order.pending.size + order.indices.size, 0)
	order.stage(scope, ['a', 'b'], { a: 0, b: 1 })
	order.deleted(scope.field)
	assert.equal(order.pending.size + order.indices.size, 0)
})

async function loadManager(instance) {
	const { readFile } = await import('node:fs/promises')
	const ts = (await import('typescript')).default
	const source = (await readFile(new URL('../../src/lib/pocketbase/CollectionManager.ts', import.meta.url), 'utf8'))
		.replace(/^import .*\n/gm, '')
		.replace('export const createCollectionManager', 'const createCollectionManager')
	const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/export \{\};?/g, '')
	return Function('OrderedSvelteMap', 'is_files_mode', 'createEntryReordering', `${js}; return createCollectionManager;`)(Map, () => false, createEntryReordering)(instance)
}

test('one Save finishes moves queued during its request and persists their new dependencies first', async () => {
	const requests = []
	let finishFirst
	let startedFirst
	const firstStarted = new Promise((resolve) => {
		startedFirst = resolve
	})
	const manager = await loadManager({
		collection: () => ({
			create: async (data) => {
				requests.push(`create:${data.id}`)
				return data
			}
		}),
		send: async (_path, { body }) => {
			requests.push([...body.ids])
			if (requests.length === 1) {
				startedFirst()
				return new Promise((resolve) => {
					finishFirst = resolve
				})
			}
			return { items: body.ids.map((id, index) => ({ id, index })) }
		}
	})
	manager.entry_reordering.stage(scope, ['b', 'a'], { a: 0, b: 1 })
	const saving = manager.commit()
	await firstStarted
	const data = manager.entry_reordering.created(scope.collection, { id: 'c', section: 'section', field: 'items', locale: 'en', index: 2 })
	manager.changes.set('c', { collection: scope.collection, operation: 'create', committed: false, data })
	manager.entry_reordering.stage(scope, ['c', 'b', 'a'], { a: 0, b: 1, c: data.index })
	finishFirst({
		items: [
			{ id: 'b', index: 0 },
			{ id: 'a', index: 1 }
		]
	})
	await saving
	assert.deepEqual(requests, [['b', 'a'], 'create:c', ['c', 'b', 'a']])
	assert.equal(manager.entry_reordering.pending.size, 0)
})

test('an ordinary create failure leaves the draft available for a successful Save retry', async () => {
	let fail = true
	const manager = await loadManager({
		collection: () => ({
			create: async (data) => {
				if (fail) throw new Error('offline')
				return data
			}
		})
	})
	manager.changes.set('a', { collection: scope.collection, operation: 'create', committed: false, data: { id: 'a', index: 0 } })
	await assert.rejects(manager.commit(), /offline/)
	assert.equal(manager.changes.get('a').committed, false)
	fail = false
	await manager.commit()
	assert.equal(manager.changes.get('a').committed, true)
	assert.equal(manager.records.get('a').data.id, 'a')
})
