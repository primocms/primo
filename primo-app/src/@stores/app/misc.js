import {writable} from 'svelte/store'

export const onDashboard = writable(false)

export const editorViewDev = writable(true)

export const userRole = writable('developer')