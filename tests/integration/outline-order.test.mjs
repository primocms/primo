import test from 'node:test'
import assert from 'node:assert/strict'
import { dropIndex, moveInOrder, createOutlineHistory, recoverOutlineOperation } from '../../src/lib/builder/stores/app/outline-order.js'

test('outline drop gaps match resulting order in both directions and at the end', () => {
	const ids = ['a', 'b', 'c', 'd']
	assert.deepEqual(moveInOrder(ids, 'a', dropIndex(0, 2, 4)), ['b', 'a', 'c', 'd'])
	assert.deepEqual(moveInOrder(ids, 'a', dropIndex(0, 4, 4)), ['b', 'c', 'd', 'a'])
	assert.deepEqual(moveInOrder(ids, 'd', dropIndex(3, 1, 4)), ['a', 'd', 'b', 'c'])
	assert.deepEqual(moveInOrder(ids, 'b', dropIndex(1, 2, 4)), ids)
	assert.equal(moveInOrder(ids, 'missing', 0), null)
	assert.equal(dropIndex(-1, 0, 4), null)
	assert.deepEqual(ids, ['a', 'b', 'c', 'd'])
})

test('outline history executes persistence and retains cursor after failed save', async () => {
	const history = createOutlineHistory()
	let persisted = 'renamed'
	let fail = true
	history.record({
		undo: async () => {
			if (fail) throw new Error('offline')
			persisted = 'original'
		},
		redo: async () => {
			persisted = 'renamed'
		}
	})
	await assert.rejects(history.undo(), /offline/)
	assert.equal(history.canUndo, true)
	assert.equal(history.canRedo, false)
	fail = false
	await history.undo()
	assert.equal(persisted, 'original')
	assert.equal(history.canUndo, false)
	assert.equal(history.canRedo, true)
	await history.redo()
	assert.equal(persisted, 'renamed')
	await history.undo()
	history.record({ undo: async () => {}, redo: async () => {} })
	assert.equal(history.canRedo, false)
	history.clear()
	assert.equal(history.canUndo, false)
})

test('failed outline save restores partial writes and leaves unrelated pending work intact', async () => {
	const unrelated = { collection: 'page_sections', operation: 'update', committed: false, data: { outline_name: 'Unrelated draft' } }
	const changed = { collection: 'page_sections', operation: 'update', committed: true, data: { index: 1 } }
	const created = { collection: 'page_sections', operation: 'create', committed: false, data: { index: 2 } }
	const changes = new Map([
		['other', unrelated],
		['a', changed],
		['new', created]
	])
	const records = new Map()
	const writes = []
	const client = {
		collection: (name) => ({
			update: async (id, data) => {
				writes.push(['update', name, id])
				return data
			},
			delete: async (id) => writes.push(['delete', name, id])
		})
	}
	assert.equal(
		await recoverOutlineOperation({
			changes,
			before: new Map([['other', unrelated]]),
			operation: new Map([
				['a', changed],
				['new', created]
			]),
			originals: new Map([['a', { id: 'a', index: 0 }]]),
			records,
			client
		}),
		true
	)
	assert.deepEqual(writes, [
		['update', 'page_sections', 'a'],
		['delete', 'page_sections', 'new']
	])
	assert.equal(changes.get('other'), unrelated)
	assert.equal(changes.has('a'), false)
	assert.equal(records.get('a').data.index, 0)
	assert.equal(records.get('new'), null)
})

test('rollback reports failed recovery and discards stale cache instead of reporting saved', async () => {
	const change = { collection: 'page_sections', operation: 'update', committed: true }
	const records = new Map([['a', { data: { index: 1 } }]])
	const success = await recoverOutlineOperation({
		changes: new Map([['a', change]]),
		before: new Map(),
		operation: new Map([['a', change]]),
		originals: new Map([['a', { index: 0 }]]),
		records,
		client: {
			collection: () => ({
				update: async () => {
					throw new Error('offline')
				}
			})
		}
	})
	assert.equal(success, false)
	assert.equal(records.has('a'), false)
})

test('clearing page history prevents stale commands executing on another page', async () => {
	const history = createOutlineHistory()
	let writes = 0
	history.record({ undo: async () => writes++, redo: async () => writes++ })
	history.clear()
	await history.undo()
	await history.redo()
	assert.equal(writes, 0)
})
