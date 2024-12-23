import { writable } from 'svelte/store'

export const site = writable(null)

export const signed_in = writable(false)
export const user = writable({ id: null })

export const emails = writable([])

export const workspaces = writable([])

export const active_users = writable([])

export const compilers_registered = writable(false)
