import { writable, readonly, derived, get } from 'svelte/store'

export type AuthorMode = 'files' | 'cms' | 'both'

const author_mode_store = writable<AuthorMode>('both')

export const author_mode = readonly(author_mode_store)

// True while the initial dev-auth refresh is in flight. The store's default
// ('both') is editable, so on a files-author CLI the pre-refresh window would
// briefly render mutation controls as editable; read_only stays locked until
// the real mode lands. Only refresh_author_mode() sets this, and it only runs
// on localhost — production keeps the unlocked 'both' default.
const refresh_pending_store = writable(false)

// Single source of truth for Browse mode. In files-author mode the CLI owns
// the content on disk and re-projects it into the CMS, so the editor is an
// inspector: everything stays navigable, nothing is writable. Components
// should subscribe to this rather than comparing `author_mode` themselves.
export const read_only = derived([author_mode_store, refresh_pending_store], ([mode, pending]) => pending || mode === 'files')

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
	refresh_pending_store.set(true)
	refresh_promise = fetch('/api/primo/dev-auth', { method: 'POST' })
		.then(async (response) => {
			if (!response.ok) return
			const data = await response.json().catch(() => null)
			const mode = data?.author_mode
			// Only an authoritative answer may unlock: a failed or malformed
			// refresh leaves no grounds to expose mutation controls, so the
			// pending lock stays up rather than falling back to editable.
			if (mode === 'files' || mode === 'cms' || mode === 'both') {
				set_author_mode(mode)
				refresh_pending_store.set(false)
			}
		})
		.catch(() => {
			// Dev auth failed — stay pending-locked (see above)
		})
		.finally(() => {
			refresh_promise = null
		})
	return refresh_promise
}
