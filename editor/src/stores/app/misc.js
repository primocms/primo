import {writable} from 'svelte/store'
import {browser} from '$app/environment'

export const saving = writable(false)

export const saved = writable(true)

export const showingIDE = writable(false)

export const userRole = writable('developer')

export const showKeyHint = writable(false)

export const loadingSite = writable(false)

export const onMobile = browser ? writable(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) : writable(false)

export const locale = writable('en')

export const highlightedElement = writable(null)