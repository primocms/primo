import type { Entry } from '$lib/common/models/Entry'
import type { Field } from '$lib/common/models/Field'
import { identify_entity_collection, type Entity } from '$lib/Entity'
import { orderKey } from '$lib/pocketbase/entry-reordering.js'

const collections = {
	library_symbols: 'library_symbol_entries',
	sites: 'site_entries',
	site_symbols: 'site_symbol_entries',
	page_types: 'page_type_entries',
	pages: 'page_entries',
	page_type_sections: 'page_type_section_entries',
	page_sections: 'page_section_entries'
} as const

export function repeaterScope(entity: Entity, field: Field, parent?: Entry, locale = 'en') {
	const collection = collections[identify_entity_collection(entity)]
	const ownerKey = collection === 'page_entries' ? 'page' : collection.endsWith('section_entries') ? 'section' : null
	return { collection, owner: entity.id, ownerKey, field: field.id, parent: parent?.id || '', locale }
}

export function reorderRepeater(entity: Entity, field: Field, parent: Entry | undefined, entries: Entry[], movedId: string, targetId: string, edge: 'top' | 'bottom') {
	const from = entries.findIndex((entry) => entry.id === movedId)
	const target = entries.findIndex((entry) => entry.id === targetId)
	if (from < 0 || target < 0 || movedId === targetId) return false
	const ids = entries.map((entry) => entry.id)
	ids.splice(from, 1)
	ids.splice(ids.indexOf(targetId) + (edge === 'bottom' ? 1 : 0), 0, movedId)
	if (ids.every((id, index) => id === entries[index].id)) return false
	const manager = entity.collection.manager
	const expected = Object.fromEntries(
		entries.map((entry) => {
			const change = manager.changes.get(entry.id)
			const raw = change?.operation === 'create' ? change.data : manager.records.get(entry.id)?.data
			return [entry.id, (raw as Entry | undefined)?.index ?? entry.index]
		})
	)
	manager.entry_reordering.stage(repeaterScope(entity, field, parent, entries[from].locale), ids, expected)
	return true
}

export { orderKey }
