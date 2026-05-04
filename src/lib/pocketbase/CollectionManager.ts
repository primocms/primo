import type { ObjectWithId } from './Object'
import { OrderedSvelteMap } from './OrderedSvelteMap'
import { is_files_mode } from './author_mode'
import type Client from 'pocketbase'

export type Change<T extends ObjectWithId> =
	| { collection: string; operation: 'create'; committed: boolean; data: Omit<T, 'id'> }
	| { collection: string; operation: 'update'; committed: boolean; data: Partial<T> }
	| { collection: string; operation: 'delete'; committed: boolean }

export type TrackedRecord = {
	data: ObjectWithId
}

export type TrackedList = {
	invalidated: boolean
	ids: string[]
}

export type CollectionManager = ReturnType<typeof createCollectionManager>

export const createCollectionManager = (instance?: Client) => {
	const changes = new OrderedSvelteMap<string, Change<ObjectWithId>>()
	const records = new OrderedSvelteMap<string, TrackedRecord | undefined | null>()
	const lists = new OrderedSvelteMap<string, TrackedList | undefined | null>()

	let promise = Promise.resolve()

	const commitChanges = async () => {
		if (!instance) {
			throw new Error('No instance')
		}

		// Process each change individually
		for (const [id, change] of changes) {
			// Skip already committed changes
			if (change.committed) {
				continue
			}

			change.committed = true

			try {
				switch (change.operation) {
					case 'create': {
						const result = await instance.collection(change.collection).create(change.data)
						records.set(id, { data: result })
						break
					}

					case 'update': {
						const result = await instance.collection(change.collection).update(id, change.data)
						records.set(id, { data: result })
						break
					}

					case 'delete': {
						await instance.collection(change.collection).delete(id)
						records.set(id, null)
						break
					}
				}
			} catch (error) {
				// Undo change on failure
				changes.delete(id)
				throw error
			}
		}
	}

	return {
		instance,
		changes,
		records,
		lists,
		commit: async () => {
			// In files-author mode the CLI's sync layer overwrites the DB on
			// the next pull, so committing here would create user-visible
			// edits that vanish. Drop pending changes instead.
			if (is_files_mode()) {
				for (const [id, change] of [...changes]) {
					if (!change.committed) {
						changes.delete(id)
					}
				}
				return
			}
			promise = promise.then(commitChanges, commitChanges)
			return promise
		},
		discard: () => {
			for (const [id, change] of [...changes]) {
				if (!change.committed) {
					changes.delete(id)
				}
			}
		}
	}
}
