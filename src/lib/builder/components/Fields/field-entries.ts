import type { Field } from '$lib/common/models/Field'
import type { Entry } from '$lib/common/models/Entry'

/** Values are addressed by slot; moves address existing repeater containers by ID. */
export type FieldValueMap = Record<string, Record<number, { value: unknown; subValues?: FieldValueMap } | { entryId: string; value?: never }>>
export type FieldValueHandler = (values: FieldValueMap) => void

export function setFieldEntries(options: {
	fields?: Field[]
	entries?: Entry[]
	updateEntry: (id: string, data: Partial<Entry>) => Entry
	createEntry: (data: Omit<Entry, 'id'>) => Entry
	values: FieldValueMap
	parent?: Entry
}) {
	const { fields, entries, updateEntry, createEntry, values, parent } = options
	for (const [key, items] of Object.entries(values)) {
		for (const index in items) {
			const field = fields?.find((field) => field.key === key && (parent ? field.parent === parent?.field : !field.parent))
			if (!field) {
				continue
			}

			const change = items[index]
			// Reordering addresses the container by identity, never by its old slot.
			// Only its index changes; descendants retain their IDs and parents.
			if ('entryId' in change) {
				const entry = entries?.find((entry) => entry.id === change.entryId && entry.field === field.id && (parent ? entry.parent === parent.id : !entry.parent))
				if (field.type === 'repeater' && entry) updateEntry(entry.id, { index: +index })
				continue
			}

			let entry = entries?.find((entry) => entry.field === field?.id && (parent ? entry.parent === parent?.id : !entry.parent) && entry.index === +index)
			if (entry) {
				entry = updateEntry(entry.id, { value: change.value })
			} else {
				entry = createEntry({ field: field.id, parent: parent?.id, index: +index, locale: 'en', value: change.value })
			}

			if (change.subValues) {
				setFieldEntries({ ...options, values: change.subValues, parent: entry })
			}
		}
	}
}
