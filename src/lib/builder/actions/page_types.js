import { cloneDeep } from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import { goto } from '$app/navigation'
import active_page_store from '$lib/builder/stores/data/page'
import stores, { update_timeline } from '$lib/builder/stores/data'
import { site } from '$lib/builder/stores/data/site'
import { dataChanged } from '$lib/builder/database'
import { Section, Page_Type } from '$lib/builder/factories'
import { handle_field_changes, handle_content_changes } from './_helpers'
import * as db_utils from './_db_utils'
import * as helpers from '$lib/builder/actions/_helpers'

export default {
	/** @param {{ id: string, name: string, color: string, icon: string }} pt_options */
	create: async (pt_options) => {
		// const original_pages = cloneDeep(get(stores.pages))

		const new_page_type = Page_Type({
			...pt_options,
			owner_site: get(site)['id']
		})

		await dataChanged({
			table: 'page_types',
			action: 'insert',
			data: _.omit(new_page_type, ['entries', 'fields'])
		})

		stores.page_types.update((store) => [...store, new_page_type])

		// insert block-drop-zone section (i.e. section w/o symbol)
		await dataChanged({
			table: 'sections',
			action: 'insert',
			data: {
				page_type: new_page_type.id,
				index: 0
			}
		})

		// TODO: reinstate undo/redo

		// let db_id
		// await update_timeline({
		// 	doing: async () => {
		// 	},
		// 	undoing: async () => {
		// 		// TODO: test
		// 		stores.pages.set(original_pages)
		// 		await dataChanged({ table: 'page_types', action: 'delete', id: db_id })
		// 	}
		// })
		// return db_id
	},
	delete: async (page_type_id) => {
		const original_page_types = cloneDeep(get(stores.page_types))
		const updated_page_types = original_page_types.filter((page_type) => page_type.id !== page_type_id)
		stores.page_types.set(updated_page_types)
		await dataChanged({ table: 'page_types', action: 'delete', id: page_type_id })

		// Go to home page if active page is deleted
		if (get(active_page_store).id === page_type_id) {
			await goto(`/${get(site)['url']}`)
		}

		// TODO: reinstate undo/redo
		// await update_timeline({
		// 	doing: async () => {
		// 	},
		// 	undoing: async () => {
		// 		stores.page_types.set(original_page_types)
		// 		await dataChanged({ table: 'page_types', action: 'insert', data: deleted_page_types })
		// 		await dataChanged({ table: 'sections', action: 'insert', data: deleted_sections })
		// 	}
		// })
	},
	update: async (page_id, obj) => {
		const current_page_types = cloneDeep(get(stores.page_types))
		const updated_page_types = current_page_types.map((page) => (page.id === page_id ? { ...page, ...obj } : page))
		stores.page_types.set(updated_page_types)
		stores.page_type.update((store) => ({ ...store, ...obj }))
		await dataChanged({ table: 'page_types', action: 'update', id: page_id, data: obj })

		// TODO: reinstate undo/redo

		// const original_page = cloneDeep(get(stores.page_types).find((page) => page.id === page_id))
		// const current_page_types = cloneDeep(get(stores.page_types))
		// const updated_page_types = current_page_types.map((page) => (page.id === page_id ? { ...page, ...obj } : page))
		// stores.page_types.set(updated_page_types)
		// await update_timeline({
		// 	doing: async () => {
		// 	},
		// 	undoing: async () => {
		// 		stores.page_types.set(current_page_types)
		// 		await dataChanged({
		// 			table: 'page_types',
		// 			action: 'update',
		// 			id: page_id,
		// 			data: original_page
		// 		})
		// 	}
		// })
	}
}


export const update_page_type_entries = {
	store: async function (updated_entries) {
		stores.page_type.update((store) => ({ ...store, entries: updated_entries }))

		// refresh sections on page to fetch updated page entries from source
		stores.sections.update((store) => store)
	},
	db: async function (original_entries, updated_entries) {
		const changes = db_utils.generate_entry_changes(original_entries, updated_entries)
		const page_type_id = get(stores.page_type).id

		await helpers.handle_content_changes_new(changes, {
			page_type: page_type_id
		})
	}
}

export async function update_page_type({ entries, fields }) {
	const original_page_type = _.cloneDeep(get(stores.page_type))
	const page_type_id = get(stores.page_type).id

	const changes = {
		entries: db_utils.generate_entry_changes(original_page_type.entries, entries),
		fields: db_utils.generate_field_changes(original_page_type.fields, fields),
	}

	db_utils.remap_entries_and_fields({
		changes: {
			fields: changes.fields,
			entries: changes.entries
		},
		items: {
			fields,
			entries
		}
	})

	stores.page_type.update((store) => ({ ...store, entries, fields }))

	await helpers.handle_field_changes_new(changes.fields, { page_type: page_type_id })
	await helpers.handle_content_changes_new(changes.entries, {
		page_type: page_type_id
	})

	// DB: update page type instances
	const pages_of_type = await dataChanged({
		table: 'pages',
		action: 'select',
		data: 'id, entries(*)',
		match: { page_type: page_type_id }
	})

	// modify entries for pages instances
	await Promise.all(pages_of_type.map(async ({ id: page_id, entries }) => {
		const synced = helpers.sync_page_content_with_field_changes({
			page_entries: entries,
			field_changes: changes.fields,
			original_fields: original_page_type.fields,
			updated_fields: fields
		})
		await helpers.handle_content_changes_new(synced.changes, { page: page_id })
	}))

}

// toggle symbol in page type
export async function toggle_symbol({ symbol_id, page_type_id, toggled }) {
	const existing_symbol = get(stores.symbols).find((s) => s.id === symbol_id)
	const existing_symbol_page_types = existing_symbol.page_types || []
	const with_page_type = [...existing_symbol_page_types, page_type_id]
	const without_page_type = existing_symbol_page_types.filter((pt) => pt !== page_type_id)
	await dataChanged({
		table: 'symbols',
		action: 'update',
		id: symbol_id,
		data: {
			page_types: toggled ? with_page_type : without_page_type
		}
	})

	// const existing_symbol = get(stores.symbols).find((s) => s.id === symbol_id)
	// const existing_symbol_page_types = existing_symbol.page_types || []
	// const with_page_type = [...existing_symbol_page_types, page_type_id]
	// const without_page_type = existing_symbol_page_types.filter((pt) => pt !== page_type_id)
	// await update_timeline({
	// 	doing: async () => {
	// 	},
	// 	undoing: async () => {
	// 		await dataChanged({
	// 			table: 'symbols',
	// 			action: 'update',
	// 			id: symbol_id,
	// 			data: {
	// 				page_types: toggled ? null : page_type_id
	// 			}
	// 		})
	// 	}
	// })
}

export async function delete_page_type_section(section_id) {
	const updated_sections = get(stores.sections)
		.filter((s) => s.id !== section_id)
		.map((s, i) => ({ ...s, index: i }))
	stores.sections.set(updated_sections)

	await dataChanged({
		table: 'sections',
		action: 'delete',
		id: section_id
	})

	// await update_timeline({
	// 	doing: async () => {
	// 	},
	// 	undoing: async () => {
	// 		// TODO
	// 	}
	// })
}

export async function add_page_type_section(symbol, position) {
	const page_type_id = get(stores.page_type).id
	const original_sections = _.cloneDeep(get(stores.sections)).sort((a, b) => a.index - b.index)

	// DB: insert section tied to page type
	const new_section_db_id = await dataChanged({
		table: 'sections',
		action: 'insert',
		data: {
			index: position,
			symbol: symbol.id,
			page_type: page_type_id
		}
	})

	let new_section = Section({
		index: position,
		page_type: page_type_id,
		symbol: symbol.id,
		entries: symbol.entries.map((entry) => ({
			...entry,
			symbol: null,
			section: new_section_db_id
		}))
	})

	const updated_sections = [...original_sections.slice(0, position), new_section, ...original_sections.slice(position)].map((section, i) => ({ ...section, index: i }))

	// set DB ID on new section
	// _.find(updated_sections, { id: new_section.id }).id = new_section_db_id

	// STORE: add new section with update indeces
	stores.sections.set(updated_sections)

	// DB: insert entries tied to new section
	const new_section_content_db_ids = await handle_content_changes(
		symbol.entries.map((e) => ({ action: 'insert', id: e.id, data: _.omit(e, ['symbol']) })),
		[],
		{ section: new_section_db_id }
	)

	// STORE: update section entries ids
	stores.sections.update((store) =>
		store.map((section) =>
			section.id === new_section.id
				? {
						...section,
						id: new_section_db_id,
						entries: section.entries.map((entry, i) => ({
							...entry,
							id: new_section_content_db_ids[entry.id],
							parent: new_section_content_db_ids[entry.parent]
						}))
				  }
				: section
		)
	)

	// DB: fetch page type instances
	const page_instances = await dataChanged({
		table: 'pages',
		action: 'select',
		data: 'id',
		match: { page_type: page_type_id }
	})

	// DB: add new section to each page type instance
	const instance_section_ids = await dataChanged({
		table: 'sections',
		action: 'insert',
		data: page_instances.map((page) => ({
			master: new_section_db_id,
			page: page.id
		}))
	}).then((rows) => rows.map((r) => r.id))

	// DB: add entries entries for each page type instance section
	// note we can't pass all changes to handle_content_changes because of duplicate entries IDs
	await Promise.all(
		instance_section_ids.map((instance_section_id) =>
			handle_content_changes(
				symbol.entries.map((entry) => ({
					action: 'insert',
					id: entry.id,
					data: {
						..._.omit(entry, ['symbol']),
						section: instance_section_id
					}
				}))
			)
		)
	)

	// update indeces of sibling sections
	await Promise.all(
		get(stores.sections).map((s) =>
			dataChanged({
				table: 'sections',
				action: 'update',
				id: s.id,
				data: { index: s.index }
			})
		)
	)

	// TODO: undo
	// await update_timeline({
	// 	doing: async () => {
	// 	},
	// 	undoing: async () => {
	// 		// stores.sections.set(original_sections)
	// 		// await dataChanged({ table: 'sections', action: 'delete', id: new_section.id })
	// 		// await dataChanged({
	// 		// 	table: 'sections',
	// 		// 	action: 'upsert',
	// 		// 	data: original_sections
	// 		// })
	// 	}
	// })
}
