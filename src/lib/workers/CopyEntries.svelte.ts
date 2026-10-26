import type { Entry } from '$lib/common/models/Entry'
import { is_entity_of, type Entity } from '$lib/Entity'
import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
import { PageEntries, Pages, PageSectionEntries, PageSections, PageTypes, PageTypeSectionEntries, PageTypeSections, SiteSymbols } from '$lib/pocketbase/collections'
import { useSvelteWorker } from './Worker.svelte'

type SourceEntity<T extends 'page' | 'section'> = T extends 'page'
	? ObjectOf<typeof PageTypes> | ObjectOf<typeof Pages>
	: ObjectOf<typeof SiteSymbols> | ObjectOf<typeof PageTypeSections> | ObjectOf<typeof PageSections>
type DestinationEntity<T extends 'page' | 'section'> = T extends 'page' ? ObjectOf<typeof Pages> : ObjectOf<typeof PageTypeSections> | ObjectOf<typeof PageSections>

export const useCopyEntries = <T extends 'page' | 'section'>(source_entities: (SourceEntity<T> | null | undefined)[] | null | undefined) => {
	const worker = useSvelteWorker(
		() => source_entities !== undefined && (source_entities ?? []).every((entity) => entity !== undefined),
		() => source_entries !== undefined,
		(source_entity: SourceEntity<T>, destination_entity: DestinationEntity<T>) => {
			if (!source_entities || source_entities.some((entity) => !entity) || !source_entries) {
				throw new Error('Failed to copy entries, something was not found')
			}

			const source_entity_index = source_entities.findIndex((entity) => !!entity && entity.id === source_entity.id)
			if (source_entity_index < 0) {
				throw new Error('Source entity not found')
			}

			const source_entity_entries = source_entries[source_entity_index]
			create_entity_entries({
				source_entity_entries,
				destination_entity
			})
		}
	)

	const shouldLoad = $derived(['loading', 'working'].includes(worker.status))
	const source_entries = $derived.by(() => {
		if (!shouldLoad || !source_entities) {
			return undefined
		}

		const all_entries: Entry[][] = []
		for (const entity of source_entities) {
			if (!entity) return entity
			let entries: any[] | null | undefined = (entity as any).entries()
			if (!entries) return entries
			all_entries.push(entries.map((entry) => entry.values()))
		}

		return all_entries
	})

	return worker
}

export const create_entity_entries = ({
	source_entity_entries,
	source_parent_entry,
	destination_entity,
	entry_map = new Map()
}: {
	source_entity_entries: Entry[]
	source_parent_entry?: Entry
	destination_entity: DestinationEntity<any>
	entry_map?: Map<string, Entry>
}): Map<string, Entry> => {
	for (const source_entity_entry of source_entity_entries) {
		if (source_parent_entry ? source_entity_entry.parent !== source_parent_entry.id : source_entity_entry.parent) {
			continue
		}

		const parent = source_entity_entry.parent ? entry_map.get(source_entity_entry.parent) : undefined
		if (source_entity_entry.parent && !parent) {
			throw new Error('No parent entity entry')
		}

		let entry: Entry
		switch (true) {
			case is_entity_of(destination_entity, 'pages'): {
				entry = PageEntries.from(destination_entity.collection.manager)
					.create({
						...source_entity_entry,
						id: undefined,
						parent: parent?.id,
						page: destination_entity.id
					})
					.values()
				break
			}

			case is_entity_of(destination_entity, 'page_type_sections'): {
				entry = PageTypeSectionEntries.from(destination_entity.collection.manager)
					.create({
						...source_entity_entry,
						id: undefined,
						parent: parent?.id,
						section: destination_entity.id
					})
					.values()
				break
			}

			case is_entity_of(destination_entity, 'page_sections'): {
				entry = PageSectionEntries.from(destination_entity.collection.manager)
					.create({
						...source_entity_entry,
						id: undefined,
						parent: parent?.id,
						section: destination_entity.id
					})
					.values()
				break
			}

			default: {
				throw new Error('Invalid destination entity')
			}
		}

		entry_map.set(source_entity_entry.id, entry)
		create_entity_entries({
			source_entity_entries,
			source_parent_entry: source_entity_entry,
			destination_entity,
			entry_map
		})
	}
	return entry_map
}
