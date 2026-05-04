import { writable, readonly, get } from 'svelte/store'

export type AuthorMode = 'files' | 'cms' | 'both'

const author_mode_store = writable<AuthorMode>('both')

export const author_mode = readonly(author_mode_store)

export const set_author_mode = (mode: unknown) => {
	if (mode === 'files' || mode === 'cms' || mode === 'both') {
		author_mode_store.set(mode)
	} else {
		author_mode_store.set('both')
	}
}

// Synchronous read for non-Svelte modules (e.g. CollectionManager).
export const is_files_mode = () => get(author_mode) === 'files'

const is_localhost = () => {
	if (typeof window === 'undefined') return false
	const host = window.location.hostname
	return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
}

let refresh_promise: Promise<void> | null = null

// Hits the dev-auth endpoint to read the CLI's current --author flag.
// Safe to call on a route reload after the auth handshake already ran;
// the endpoint is idempotent and only available on localhost.
export const refresh_author_mode = () => {
	if (!is_localhost()) return Promise.resolve()
	if (refresh_promise) return refresh_promise
	refresh_promise = fetch('/api/palacms/dev-auth', { method: 'POST' })
		.then(async (response) => {
			if (!response.ok) return
			const data = await response.json().catch(() => null)
			set_author_mode(data?.author_mode)
		})
		.catch(() => {
			// Dev auth not available — leave default
		})
		.finally(() => {
			refresh_promise = null
		})
	return refresh_promise
}
