import { writable } from 'svelte/store'

export type OutlineRow = { id: string; name: string; shared: boolean; movable: boolean; zone: string }
export type OutlineController = {
	pageId: string
	pageName: string
	rows: OutlineRow[]
	canAdd: boolean
	structureReason: string
	canEdit: boolean
	select: (id: string, scroll?: boolean) => void
	move: (id: string, target: number) => Promise<void>
	add: (symbolId: string) => Promise<void>
	edit: (id: string) => void
	canUndo: boolean
	canRedo: boolean
	undo: () => Promise<void>
	redo: () => Promise<void>
}
export const outline = writable<OutlineController | null>(null)
export const outlineSelection = writable<string | null>(null)
export const outlineInsertion = writable<number | null>(null)
export const outlineBusy = writable(false)
export const outlineMessage = writable('')
export type SidebarTab = 'outline' | 'blocks' | 'content'
export function readPreference(key: string) {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
	} catch {
		return null
	}
}
export function writePreference(key: string, value: string) {
	try {
		localStorage.setItem(key, value)
	} catch {
		/* Storage can be disabled. */
	}
}
const remembered = readPreference('primo:page-sidebar-tab')
export const pageSidebarTab = writable<SidebarTab>(remembered === 'blocks' || remembered === 'content' ? remembered : 'outline')
pageSidebarTab.subscribe((tab) => writePreference('primo:page-sidebar-tab', tab))

export const sidebarReveal = writable(0)
