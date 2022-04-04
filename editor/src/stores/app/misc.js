import {writable} from 'svelte/store'

export const modKeyDown = writable(false)

export const saving = writable(false)

export const saved = writable(true)

export const showingIDE = writable(false)

export const userRole = writable('developer')

export const showKeyHint = writable(false)

export const loadingSite = writable(true)

export const onMobile = writable(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))

export const locale = writable('en')