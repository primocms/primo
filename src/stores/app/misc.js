import {writable} from 'svelte/store'

export const onDashboard = writable(false)

export const saving = writable(false)

export const editorViewDev = writable(true)

export const userRole = writable('developer')

export const hideReleaseNotes = writable(window.localStorage.getItem('hideReleaseNotes'))