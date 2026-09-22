/** Convert a gap in the original list to the final index after removing the source. */
export function dropIndex(source, gap, length) {
	if (source < 0 || source >= length || gap < 0 || gap > length) return null
	return gap > source ? gap - 1 : gap
}

export function moveInOrder(ids, id, target) {
	const source = ids.indexOf(id)
	if (source < 0 || target < 0 || target >= ids.length || !Number.isInteger(target)) return null
	const next = [...ids]
	next.splice(source, 1)
	next.splice(target, 0, id)
	return next
}

/** Keep history page-local; a failed operation never advances the cursor. */
export function createOutlineHistory(limit = 30) {
	let undo = []
	let redo = []
	return {
		get canUndo() {
			return undo.length > 0
		},
		get canRedo() {
			return redo.length > 0
		},
		record(command) {
			undo.push(command)
			undo = undo.slice(-limit)
			redo = []
		},
		clear() {
			undo = []
			redo = []
		},
		async undo() {
			const command = undo.at(-1)
			if (!command) return
			await command.undo()
			undo.pop()
			redo.push(command)
		},
		async redo() {
			const command = redo.at(-1)
			if (!command) return
			await command.redo()
			redo.pop()
			undo.push(command)
		}
	}
}

/** Compensate only records written by a failed outline operation. */
export async function recoverOutlineOperation({ changes, before, committed_before, operation, originals, records, client }) {
	let recovered = true
	for (const [id, change] of operation) {
		if (changes.get(id) === change) changes.delete(id)
		try {
			if (change.collection === 'page_sections' && originals.has(id)) {
				const record = await client.collection('page_sections').update(id, originals.get(id))
				records.set(id, { data: record })
			} else if (change.operation === 'create') {
				try {
					await client.collection(change.collection).delete(id)
				} catch (error) {
					if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) throw error
				}
				records.set(id, null)
			}
		} catch {
			recovered = false
			records.delete(id)
		}
		// `before` holds the same Change objects as the live map, and commit()
		// flips `committed` on them before each request — so reading it here
		// would report a change that was still pending when the operation began
		// as already committed, and drop the user's unsaved edit instead of
		// restoring it. Use the pre-operation snapshot.
		const previous = before.get(id)
		if (previous && !committed_before?.get(id)) changes.set(id, previous)
	}
	return recovered
}
