import type { default as PocketBase, RecordAuthResponse } from 'pocketbase'
import type { z } from 'zod'
import { customAlphabet } from 'nanoid'
import { untrack } from 'svelte'
import type { ObjectWithId } from './Object'
import type { CollectionManager } from './CollectionManager'

export type ObjectOf<T> = T extends CollectionMapping<infer Object, infer Options> ? MappedObject<Object, Options> : never

export type MappedObject<T extends ObjectWithId, Options extends CollectionMappingOptions<T>> = T &
	NonNullable<Options['links']> & { collection: CollectionMapping<T, CollectionMappingOptions<T>>; values: () => T }

export type MappedObjectList<T extends ObjectWithId, Options extends CollectionMappingOptions<T>> = MappedObject<T, Options>[]

export type ListOptions = {
	sort?: string
	filter?: Record<string, string>
}

export type CollectionMappingOptions<T extends ObjectWithId> = {
	links?: Record<string, (this: MappedObject<T, { links: {} }>) => unknown>

	/**
	 * Whether to enable real-time updates for the collection.
	 *
	 * @default false
	 */
	subscribe?: boolean
}

export type CollectionMapping<T extends ObjectWithId, Options extends CollectionMappingOptions<T>> = {
	one: (id: string) => MappedObject<T, Options> | undefined | null
	list: (options?: ListOptions) => MappedObjectList<T, Options> | undefined | null
	create: (values: Omit<T, 'id'> & { id?: string }) => MappedObject<T, Options>
	update: (id: string, values: Partial<T>) => MappedObject<T, Options>
	delete: (id: string) => void
	authWithPassword: (usernameOrEmail: string, password: string) => Promise<RecordAuthResponse<MappedObject<T, Options>>>
	requestPasswordReset: (email: string) => Promise<void>
	confirmPasswordReset: (passwordResetToken: string, password: string, passwordConfirm: string) => Promise<void>
	from: (manager: CollectionManager) => CollectionMapping<T, { links: Options['links']; subscribe: false }>
	manager: CollectionManager
}

const generateId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 15)

// Fields written only by the publish worker (Publish.svelte.ts), not edited
// in the UI. PocketBase realtime echoes every write back to the writing
// client, so without this filter clicking "Build Preview" fans out one echo
// per page/symbol and re-derives every consumer reading those records —
// visible as the editor "refreshing" on publish.
const PUBLISH_ARTIFACT_FIELDS: Record<string, string[]> = {
	pages: ['compiled_html'],
	site_symbols: ['compiled_js'],
	sites: ['preview']
}

const ECHO_IGNORED_KEYS = ['updated', 'id', 'collectionId', 'collectionName']

const isPublishArtifactEcho = (
	collectionName: string,
	before: Record<string, unknown> | undefined,
	after: Record<string, unknown>
): boolean => {
	const artifactFields = PUBLISH_ARTIFACT_FIELDS[collectionName]
	if (!artifactFields || !before) return false

	const keys = new Set([...Object.keys(before), ...Object.keys(after)])
	for (const key of keys) {
		if (ECHO_IGNORED_KEYS.includes(key)) continue
		if (before[key] === after[key]) continue
		if (!artifactFields.includes(key)) return false
	}
	return true
}

export const createCollectionMapping = <T extends ObjectWithId, Options extends CollectionMappingOptions<T>>(
	name: string,
	model: z.ZodType<T>,
	manager: CollectionManager,
	options?: Options
): CollectionMapping<T, Options> => {
	const { instance, changes, records, lists } = manager
	const collection = instance?.collection(name)

	if (collection && options?.subscribe) {
		collection.subscribe('*', (data) => {
			const operation = data.action as 'create' | 'update' | 'delete'
			const values = data.record
			const id = values.id

			const cached = records.get(id)?.data as Record<string, unknown> | undefined
			if (operation === 'update' && isPublishArtifactEcho(name, cached, values)) {
				// Refresh cache so future reads see the new artifact, but skip
				// `changes` so reactive consumers don't re-derive.
				records.set(id, { data: values })
				return
			}

			const existingChange = changes.get(id)
			if (operation === 'update' && existingChange && existingChange.operation === 'update' && !existingChange.committed) {
				// Ignore remote change. Local change will overwrite it.
				return
			}

			// Reset position of the change to place it the last
			changes.delete(id)
			changes.set(id, { collection: name, operation, committed: true, data: values })
		})
	}

	const mapObject = (record: unknown): MappedObject<T, Options> => {
		const object = model.parse(record)
		const links = Object.fromEntries(
			Object.entries(options?.links ?? {}).map(([property, factory]) => [property, factory.bind({ ...object, collection: collectionMapping, values: () => ({ ...object }) })])
		)
		return Object.assign({}, object, links, { collection: collectionMapping, values: () => ({ ...object }) })
	}

	const tryMapObject = (record: unknown): MappedObject<T, Options> | null => {
		try {
			return mapObject(record)
		} catch (error) {
			console.error(`Invalid ${name} record`, record, error)
			return null
		}
	}

	const collectionMapping: CollectionMapping<T, Options> = {
		one: (id) => {
			const change = changes.get(id)
			let { data } = records.get(id) ?? {}

			if (change && change.operation === 'delete') {
				return undefined
			} else if (change) {
				data = Object.assign({}, data, change.data)
			} else if (!data) {
				$effect(() => {
					// If no cached record exists, start loading it
					if (records.has(id)) {
						return
					}

					if (!collection) {
						records.set(id, null)
						return
					}

					untrack(() => {
						records.set(id, undefined)
						collection
							.getOne(id)
							.then((record) => {
								records.set(id, { data: record })
							})
							.catch((error) => {
								// Autocancelled requests are expected when the effect re-runs;
								// don't poison the record cache — the winning request will populate it.
								if (error?.isAbort || error?.status === 0) return
								console.error(error)
								records.set(id, null)
							})
					})
				})
				return data
			}

			return tryMapObject(data)
		},
		list: (options) => {
			const listId = name + JSON.stringify(options ?? {})

			const filter = Object.entries(options?.filter ?? {})
				.map(([key, value]) => `${key} = "${value}"`)
				.join(' && ')

			$effect(() => {
				// If no cached list exists or it's invalidated, start loading it
				const existingList = lists.get(listId)
				if (lists.has(listId) && !existingList?.invalidated) {
					return
				}

				if (!collection) {
					lists.set(listId, { ids: [], invalidated: false })
					return
				}

				untrack(() => {
					lists.set(listId, existingList ? { invalidated: false, ids: existingList?.ids } : undefined)
					collection
						.getFullList({
							...options,
							filter,
							requestKey: listId
						})
						.then((fetchedRecords) => {
							const validRecords = fetchedRecords.filter((record) => {
								const valid = typeof record?.id === 'string' && record.id.length > 0
								if (!valid) {
									console.error(`Invalid ${name} list record`, record)
								}
								return valid
							})
							// Store the full records
							validRecords.forEach((record) => {
								records.set(record.id, { data: record })
							})
							// Store the list of IDs
							lists.set(listId, { invalidated: false, ids: validRecords.map(({ id }) => id) })
						})
						.catch((error) => {
							// Autocancelled requests are expected when the effect re-runs;
							// the winning request will populate the list, so don't nuke the cache.
							if (error?.isAbort || error?.status === 0) return
							console.error(error)
							lists.set(listId, null)
						})
				})
			})

			const list = [...(lists.get(listId)?.ids ?? [])]
			for (const [id, change] of changes) {
				if (change.collection !== name) {
					// The change is not for this collection
					continue
				}

				// Only add non-deleted items to the list
				if (change.operation !== 'delete' && !list.includes(id)) {
					// If sorting by -created (newest first) or index (ascending), prepend new items to match expected sort order
					// New items get index=0 or the most recent timestamp, so they appear at the start
					if (options?.sort === '-created' && change.operation === 'create') {
						list.unshift(id)
					} else {
						list.push(id)
					}
				}
			}

			const originalList = lists.get(listId)
			const objects = list
				.map((id) => collectionMapping.one(id))
				.filter((object) => !!object)
				.filter((object) => {
					const values = object.values()
					for (const [key, value] of Object.entries(options?.filter ?? {})) {
						if (key.includes('.')) {
							// Ignore condition refering to a referenced collection. If that kind of
							// filter is used, filtering must be manually handled.
							continue
						}
						if (values[key] !== value) {
							return false
						}
					}
					return true
				})
			if (lists.has(listId) && !originalList) {
				return originalList
			} else if (!originalList && objects.length === 0) {
				return undefined
			} else {
				return objects
			}
		},
		create: (values) => {
			const id = values.id ?? generateId()
			const data = { ...values, id }
			changes.set(id, { collection: name, operation: 'create', committed: false, data })
			return mapObject(data)
		},
		update: (id, values) => {
			let change = changes.get(id)
			if (change && change.operation === 'create' && !change.committed) {
				changes.set(
					id,
					// Create a new operation object to ensure reactivity
					{
						collection: name,
						operation: 'create',
						committed: false,
						data: { ...change.data, ...values }
					}
				)
			} else if (change && change.operation === 'update' && !change.committed) {
				// Reset position of the change to place it the last
				changes.delete(id)

				changes.set(
					id,
					// Create a new operation object to ensure reactivity
					{
						collection: name,
						operation: 'update',
						committed: false,
						data: { ...change.data, ...values }
					}
				)
			} else {
				// Reset position of the change to place it the last
				changes.delete(id)

				change = { collection: name, operation: 'update', committed: false, data: values }
				changes.set(id, change)
			}

			let { data } = records.get(id) ?? {}
			data = Object.assign({}, data, change.data)
			return mapObject(data)
		},
		delete: (id) => {
			const change = changes.get(id)
			if (change?.operation === 'create' && !change.committed) {
				changes.delete(id)
			} else {
				// Reset position of the change to place it the last
				changes.delete(id)

				changes.set(id, { collection: name, operation: 'delete', committed: false })
			}
		},
		authWithPassword: async (usernameOrEmail, password) => {
			if (!collection) {
				throw new Error('No collection')
			}

			const response = await collection.authWithPassword(usernameOrEmail, password)
			records.set(response.record.id, { data: response.record })

			// Clear loaded data because authorization has been updated.
			lists.clear()
			records.clear()

			const mappedRecord = tryMapObject(response.record)
			if (!mappedRecord) {
				throw new Error(`Invalid ${name} auth record`)
			}
			return { ...response, record: mappedRecord }
		},
		requestPasswordReset: async (email) => {
			if (!collection) {
				throw new Error('No collection')
			}

			await collection.requestPasswordReset(email)
		},
		confirmPasswordReset: async (passwordResetToken, password, passwordConfirm) => {
			if (!collection) {
				throw new Error('No collection')
			}

			await collection.confirmPasswordReset(passwordResetToken, password, passwordConfirm)
		},
		from: (manager: CollectionManager) => {
			return createCollectionMapping(name, model, manager, { links: options?.links, subscribe: false })
		},
		manager
	}

	return collectionMapping
}
