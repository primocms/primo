import { z } from 'zod'
import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

/**
 * Field types a plugin may declare on its own collections.
 *
 * Distinct from the CMS content field types in `src/lib/builder/field-types` —
 * those describe an editing UI for site content, these describe a storage
 * column for plugin records. Keep this list small: every type here has to map
 * onto whatever backs the `data` slot.
 */
export const DATA_FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'json', 'file', 'relation'] as const

export const DataFieldType = z.enum(DATA_FIELD_TYPES)
export type DataFieldType = (typeof DATA_FIELD_TYPES)[number]

export const DATA_FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'] as const

export const DataFilterOp = z.enum(DATA_FILTER_OPS)
export type DataFilterOp = (typeof DATA_FILTER_OPS)[number]

export const DataFilter = z.object({
	field: z.string().nonempty(),
	op: DataFilterOp,
	value: z.unknown()
})

export type DataFilter = z.infer<typeof DataFilter>

export type DataQuery = {
	/**
	 * ANDed together. A structured grammar rather than a vendor filter string, so
	 * the same query runs on any adapter — and so it can be checked before it
	 * reaches a database. Raw filter strings are what `raw()` is for.
	 */
	filter?: DataFilter[]
	sort?: { field: string; direction: 'asc' | 'desc' }[]
	limit?: number
	offset?: number
}

export type DataRecord = { id: string } & Record<string, unknown>

/**
 * Records belonging to the plugin. `collection` names are resolved relative to
 * the plugin — a plugin can only read and write the collections it declared in
 * its manifest, and never another plugin's or the CMS's own tables.
 */
export type DataAdapter = Adapter & {
	insert(collection: string, record: Record<string, unknown>): Promise<DataRecord>
	update(collection: string, id: string, patch: Record<string, unknown>): Promise<DataRecord>
	delete(collection: string, id: string): Promise<void>
	get(collection: string, id: string): Promise<DataRecord | null>
	list(collection: string, query?: DataQuery): Promise<{ records: DataRecord[]; total: number }>
}

const methods = ['insert', 'update', 'delete', 'get', 'list'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<DataAdapter>> = true

export const data: CapabilityDescriptor = {
	id: 'data',
	label: 'Data',
	description: 'Store structured records in collections the plugin declares.',
	methods,
	server_only_methods: [],
	has_default_adapter: true
}
