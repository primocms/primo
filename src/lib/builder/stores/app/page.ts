import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'

// Rendered site + active page-type head, shared by every editor preview.
export const site_html: Writable<string | null> = writable(null)
export const page_html: Writable<string | null> = writable(null)
