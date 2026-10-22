// Order drafts are separate from value changes: indices must reach the server
// together, while new entries/fields still use the normal dependency order.
export const orderKey = (scope) => JSON.stringify([scope.collection, scope.owner, scope.field, scope.parent || '', scope.locale])
export const inOrderScope = (data, scope) =>
	data.field === scope.field && (data.parent || '') === scope.parent && data.locale === scope.locale && (!scope.ownerKey || data[scope.ownerKey] === scope.owner)

export function createEntryReordering({ pending, indices, errors }) {
	function publish(key, order) {
		const previous = pending.get(key)
		for (const id of previous?.ids ?? []) indices.delete(id)
		pending.set(key, order)
		order.ids.forEach((id, index) => indices.set(id, index))
		errors.delete(key)
	}
	return {
		pending,
		indices,
		errors,
		stage(scope, ids, expected) {
			const key = orderKey(scope)
			const previous = pending.get(key)
			publish(key, { ...scope, ids: [...ids], expected: Object.fromEntries(ids.map((id) => [id, previous?.expected[id] ?? expected[id]])) })
		},
		created(collection, data) {
			for (const [key, order] of pending) {
				if (order.collection === collection && inOrderScope(data, order)) {
					// A normalized draft may have lower indices than the persisted
					// list. Append beyond its baseline so an interrupted create/save
					// cannot leave duplicate server indices before the transaction.
					data = { ...data, index: Math.max(-1, ...Object.values(order.expected)) + 1 }
					publish(key, { ...order, ids: [...order.ids, data.id], expected: { ...order.expected, [data.id]: data.index } })
				}
			}
			return data
		},
		deleted(id) {
			for (const [key, order] of [...pending]) {
				if (order.parent === id || order.field === id || order.owner === id) {
					pending.delete(key)
					for (const item of order.ids) indices.delete(item)
					errors.delete(key)
					continue
				}
				if (!order.ids.includes(id)) continue
				const expected = { ...order.expected }
				delete expected[id]
				publish(key, { ...order, ids: order.ids.filter((item) => item !== id), expected })
			}
		},
		async commit(instance, records, changes, onCommitted) {
			for (const key of [...pending.keys()]) {
				const order = pending.get(key)
				if (!order) continue
				try {
					const result = await instance.send('/api/primo/repeater-order', { method: 'POST', body: order, requestKey: null })
					for (const record of result.items) {
						records.set(record.id, { data: record })
						const change = changes.get(record.id)
						if (change?.committed && change.operation !== 'delete') changes.set(record.id, { ...change, data: { ...change.data, index: record.index } })
					}
					if (pending.get(key) === order) {
						pending.delete(key)
						for (const id of order.ids) indices.delete(id)
					} else if (pending.has(key)) {
						// A second move arrived while saving. Keep it visible and use the
						// confirmed server order as its next conflict-check baseline.
						const current = pending.get(key)
						const expected = { ...current.expected }
						for (const record of result.items) if (current.ids.includes(record.id)) expected[record.id] = record.index
						publish(key, { ...current, expected })
					}
					errors.delete(key)
					onCommitted?.({ collection: order.collection, operation: 'update' })
				} catch (error) {
					errors.set(
						key,
						error && typeof error === 'object' && 'status' in error && error.status === 409
							? 'This list changed elsewhere. Reload before rearranging it again.'
							: 'The order could not be saved. Try saving again.'
					)
					throw error
				}
			}
		},
		discard() {
			pending.clear()
			indices.clear()
			errors.clear()
		}
	}
}
