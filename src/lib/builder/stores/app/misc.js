import { writable } from 'svelte/store'

export const saved = writable(true)

export const userRole = writable('DEV')

export const mod_key_held = writable(false)

export const loadingSite = writable(false)

export const onMobile = !import.meta.env.SSR
	? writable(
			/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
	  )
	: writable(false)

export const locale = writable('en')

export const highlightedElement = writable(null)

export const locked_blocks = writable([])
export const active_users = writable([])

export const page_loaded = writable(false)

export const dragging_symbol = writable(false)