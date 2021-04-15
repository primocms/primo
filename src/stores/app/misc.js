import {writable} from 'svelte/store'

export const saving = writable(false)

export const switchEnabled = writable(true)

export const userRole = writable('developer')

export const unsaved = writable(false)

export const showKeyHint = writable(false)

export const loadingSite = writable(true)