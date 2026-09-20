import type { DataFilter } from './data'
import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

export type SearchDocument = {
	id: string
	title?: string
	body: string
	/** Filterable scalars only. Faceting and weighting are vendor-specific. */
	attributes?: Record<string, string | number | boolean>
}

export type SearchHit = {
	id: string
	/**
	 * Relevance, higher is better. Scales differ between engines, so it orders
	 * hits within one response and means nothing across adapters.
	 */
	score: number
	title?: string
	excerpt?: string
}

export type SearchAdapter = Adapter & {
	/** Upsert by `id`. Re-indexing an existing document replaces it. */
	index(documents: SearchDocument[]): Promise<void>
	remove(ids: string[]): Promise<void>
	query(text: string, options?: { filter?: DataFilter[]; limit?: number; offset?: number }): Promise<{ hits: SearchHit[]; total: number }>
}

const methods = ['index', 'remove', 'query'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<SearchAdapter>> = true

export const search: CapabilityDescriptor = {
	id: 'search',
	label: 'Search',
	description: 'Full-text search over pages, content and plugin records.',
	methods,
	// A search box needs `query` from the browser; letting it rewrite the index
	// from there does not follow.
	server_only_methods: ['index', 'remove'],
	has_default_adapter: true
}
