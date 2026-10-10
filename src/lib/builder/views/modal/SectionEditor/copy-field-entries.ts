import type { Entry } from '$lib/common/models/Entry'

// New fields can contain whole entry trees, or live below an existing group or
// repeater. Remap every parent to a symbol entry instead of a section entry.
export function copy_new_field_entries({
	entries,
	field_ids,
	symbol_entries,
	create_entry
}: {
	entries: Entry[]
	field_ids: ReadonlySet<string>
	symbol_entries: Entry[]
	create_entry: (data: Omit<Entry, 'id'>) => Entry
}) {
	const sources = new Map(entries.map((entry) => [entry.id, entry]))
	const destinations = [...symbol_entries]
	const copied = new Map<string, Entry>()
	const visiting = new Set<string>()
	const children = new Map<string, Entry[]>()
	for (const entry of entries) {
		if (entry.parent) children.set(entry.parent, [...(children.get(entry.parent) ?? []), entry])
	}

	function copy(entry: Entry): Entry {
		const previous = copied.get(entry.id)
		if (previous) return previous
		if (visiting.has(entry.id)) throw new Error('Cannot copy cyclic field entries')
		visiting.add(entry.id)
		let parent: Entry | undefined
		if (entry.parent) {
			const source_parent = sources.get(entry.parent)
			if (!source_parent) throw new Error('Cannot copy field entry without its parent')
			parent = copy(source_parent)
		}
		let destination = destinations.find(
			(candidate) => candidate.field === entry.field && candidate.locale === entry.locale && candidate.index === entry.index && (candidate.parent || undefined) === parent?.id
		)
		if (!destination) {
			destination = create_entry({ field: entry.field, locale: entry.locale, value: entry.value, index: entry.index, parent: parent?.id })
			destinations.push(destination)
		}
		copied.set(entry.id, destination)
		visiting.delete(entry.id)
		return destination
	}

	function copy_tree(entry: Entry) {
		copy(entry)
		for (const child of children.get(entry.id) ?? []) copy_tree(child)
	}
	for (const entry of entries) {
		if (field_ids.has(entry.field)) copy_tree(entry)
	}
}
