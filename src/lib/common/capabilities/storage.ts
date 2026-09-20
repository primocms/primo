import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

/**
 * A stored object. Deliberately the intersection of what PocketBase files, S3,
 * R2 and Cloudinary all return — anything richer lives behind `raw()`.
 */
export type StoredFile = {
	path: string
	url: string
	size: number
	content_type: string
}

export type ListFilesQuery = {
	prefix?: string
	limit?: number
	/** Opaque continuation token from a previous page's response. */
	cursor?: string
}

export type StorageAdapter = Adapter & {
	put(path: string, data: Uint8Array | Blob, options?: { content_type?: string }): Promise<StoredFile>
	get(path: string): Promise<StoredFile | null>
	delete(path: string): Promise<void>
	list(query?: ListFilesQuery): Promise<{ files: StoredFile[]; cursor?: string }>
	/**
	 * URL for a stored object. `expires_in` (seconds) requests a signed, expiring
	 * URL; adapters that can't sign ignore it and return the public URL, so don't
	 * treat a returned URL as private without checking the adapter.
	 */
	url(path: string, options?: { expires_in?: number }): Promise<string>
}

const methods = ['put', 'get', 'delete', 'list', 'url'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<StorageAdapter>> = true

export const storage: CapabilityDescriptor = {
	id: 'storage',
	label: 'Storage',
	description: 'Store and serve files.',
	methods,
	server_only_methods: [],
	has_default_adapter: true
}
