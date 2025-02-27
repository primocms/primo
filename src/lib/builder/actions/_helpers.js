import { dataChanged } from '$lib/builder/database'
import {get} from 'svelte/store'
import _ from 'lodash-es'
import { createUniqueID, get_empty_value } from '$lib/builder/utils'
import { sort_by_hierarchy, remap_entry_ids } from './_db_utils'
import { Content_Row } from '$lib/builder/factories'
import {get_on_page_symbol_sections} from '$lib/builder/stores/helpers'
import {page} from '$app/stores'

// TODO: put DB HELPERS in a separate file

// DB HELPERS
export async function handle_inverse_field_changes(inverse_field_changes, args = {}) {
	const field_db_ids = await handle_field_changes(inverse_field_changes, args)

	// Create an object that connects the original DBID to the new DBID, using original_to_temp_content_ids as the bridge
	const original_to_new_field_db_ids = {}

	// Map field IDs from temporary ID to DBID
	Object.entries(inverse_field_changes.original_to_temp_field_ids).forEach(([original_id, temp_id]) => {
		const db_id = field_db_ids[temp_id]
		if (db_id) {
			original_to_new_field_db_ids[original_id] = db_id
		}
	})

	return original_to_new_field_db_ids
}

export async function reverse_field_changes(field_changes, original_fields, args = {}) {
	// recreated deleted fields, then return an object which maps the original field's DBID to the recreated field's DBID
	const original_to_temp_field_ids = {}
	const original_to_new_field_db_ids = {}

	const inverse_field_changes = generate_inverse_field_changes()
	const field_db_ids = await handle_field_changes(inverse_field_changes, args)

	// Map field IDs
	Object.entries(original_to_temp_field_ids).forEach(([original_id, temp_id]) => {
		const db_id = field_db_ids[temp_id]
		if (db_id) {
			original_to_new_field_db_ids[original_id] = db_id
		}
	})

	return original_to_new_field_db_ids

	function generate_inverse_field_changes() {
		const new_field_ids = field_changes
			.filter((change) => change.action === 'delete')
			.reduce((acc, change) => {
				acc[change.id] = createUniqueID()
				return acc
			}, {})
		return field_changes.map((change) => {
			if (change.action === 'insert') {
				return {
					action: 'delete',
					id: change.id
				}
			} else if (change.action === 'update') {
				const original_field = original_fields.find((f) => f.id === change.id)
				const original_field_properties = _.pick(original_field, _.keys(change.data))
				return {
					action: 'update',
					id: change.id,
					data: original_field_properties
				}
			} else if (change.action === 'delete') {
				const original_field = original_fields.find((f) => f.id === change.id)
				const new_id = new_field_ids[original_field.id]
				const new_parent_id = new_field_ids[original_field.parent]
				original_to_temp_field_ids[change.id] = new_id
				return {
					action: 'insert',
					id: new_id,
					data: {
						...original_field,
						...(new_parent_id ? { parent: new_parent_id } : {})
					}
				}
			}
		})
	}
}

export async function reverse_content_changes(content_changes, original_entries, inverse_field_db_ids = {}, args = {}) {
	// recreated deleted fields, then return an object which maps the original field's DBID to the recreated field's DBID
	const original_to_temp_content_ids = {}
	const original_to_new_content_db_ids = {}

	const inverse_content_changes = generate_inverse_content_changes()
	const content_db_ids = await handle_content_changes(inverse_content_changes, inverse_field_db_ids, args)

	// Map field IDs
	Object.entries(original_to_temp_content_ids).forEach(([original_id, temp_id]) => {
		const db_id = content_db_ids[temp_id]
		if (db_id) {
			original_to_new_content_db_ids[original_id] = db_id
		}
	})

	return original_to_new_content_db_ids

	function generate_inverse_content_changes() {
		const new_content_ids = content_changes
			.filter((change) => change.action === 'delete')
			.reduce((acc, change) => {
				acc[change.id] = createUniqueID()
				return acc
			}, {})
		return content_changes.map((change) => {
			if (change.action === 'insert') {
				return {
					action: 'delete',
					id: change.id
				}
			} else if (change.action === 'update') {
				const original_entry = original_entries.find((f) => f.id === change.id)
				const original_entry_properties = _.pick(original_entry, _.keys(change.data))
				return {
					action: 'update',
					id: change.id,
					data: original_entry_properties
				}
			} else if (change.action === 'delete') {
				const original_entry = original_entries.find((f) => f.id === change.id)
				const new_id = new_content_ids[original_entry.id]
				const new_parent_id = new_content_ids[original_entry.parent]
				const new_field_id = inverse_field_db_ids[original_entry.field]
				original_to_temp_content_ids[change.id] = new_id
				return {
					action: 'insert',
					id: new_id,
					data: {
						...original_entry,
						...(new_parent_id ? { parent: new_parent_id } : {}),
						...(new_field_id ? { field: new_field_id } : {})
					}
				}
			}
		})
	}
}

export async function handle_field_changes_new(changes, args = {}) {

	const insertions = changes.filter((c) => c.action === 'insert').reduce((acc, change) => [ ...acc, { ...change.data, ...args } ], [])
	const updates_and_deletions = changes.filter((c) => c.action === 'update' || c.action === 'delete')

	if (insertions.length > 0) {
		await dataChanged({
			table: 'fields',
			action: 'insert',
			data: sort_by_hierarchy(insertions)
		})
	}

	await Promise.all(
		updates_and_deletions.map(async change => {
			if (change.action === 'update') {
				await dataChanged({
					table: 'fields',
					action: 'update',
					data: {
						...change.data,
						...args
					},
					id: change.id
				})
			} else if (change.action === 'delete') {
				await dataChanged({
					table: 'fields',
					action: 'delete',
					id: change.id
				})
			}
		})
	)
}

export async function handle_content_changes_new(changes, args = {}) {
	// do all insertions first, send in one insert batch
	const insertions = changes.filter((c) => c.action === 'insert').reduce((acc, change) => [ ...acc, { ...change.data, ...args } ], [])
	const updates_and_deletions = changes.filter((c) => c.action === 'update' || c.action === 'delete')

	if (insertions.length > 0) {
		// first, insert new entries
		await dataChanged({
			table: 'entries',
			action: 'insert',
			data: sort_by_hierarchy(insertions)
		})
	}

	// then do everything else, referencing new ids and existing ids
	await Promise.all(
		updates_and_deletions.map(async change => {
			if (change.action === 'update') {
				await dataChanged({
					table: 'entries',
					action: 'update',
					id: change.id,
					data: {
						...change.data,
						...args
					},
				})
			} else if (change.action === 'delete') {
				await dataChanged({
					table: 'entries',
					action: 'delete',
					id: change.id
				})
			}
		})
	)
}

export async function handle_field_changes(changes, args = {}) {
	// do all insertions first, send in one insert batch
	const insertions = changes.filter((c) => c.action === 'insert').map((c) => ({ ...c, data: { ...c.data, ...args } }))
	const updates = changes.filter((c) => c.action === 'update')
	const deletions = changes.filter((c) => c.action === 'delete')

	const field_db_ids = _.chain(insertions).keyBy('id').value()

	if (insertions.length > 0) {
		// first, insert new fields

		await dataChanged({
			table: 'fields',
			action: 'insert',
			data: insertions.map((change) => _.omit(change.data, ['id', 'parent', 'options']))
		}).then((res) => {
			res.forEach(({ id: db_id }, i) => {
				const og_id = insertions[i].id
				field_db_ids[og_id] = db_id
			})
		})

		// then, update the field parents
		await Promise.all(
			insertions
				// .filter((c) => c.data.parent)
				.filter((c) => c.data.parent || c.data.options.condition?.field)
				.map(async ({ id, data }) => {
					const updated_data = { options: data.options }
					// const parent_db_id = field_db_ids[data.parent] || data.parent
					if (data.parent) {
						updated_data.parent = field_db_ids[data.parent] || data.parent
					}
					if (data.options?.condition?.field) {
						updated_data.options.condition.field = field_db_ids[data.options.condition.field] || data.options.condition.field
					}
					await dataChanged({
						table: 'fields',
						action: 'update',
						id: field_db_ids[id],
						data: updated_data
					})
				})
		)
	}

	// then do everything else, referencing new ids and existing ids
	await Promise.all([
		...updates.map(async ({ id, data }) => {
			const updated_data = _.cloneDeep(data)
			if (data.parent) {
				updated_data.parent = field_db_ids[data.parent] || data.parent
			}
			if (data.options?.condition?.field) {
				updated_data.options.condition.field = field_db_ids[data.condition?.field] || data.options.condition.field
			}
			await dataChanged({
				table: 'fields',
				action: 'update',
				id,
				data: updated_data
			})
		}),
		...deletions.map(async ({ id }) =>
			dataChanged({
				table: 'fields',
				action: 'delete',
				id
			})
		)
	])

	return field_db_ids
}

export async function handle_content_changes(changes, field_db_ids = {}, args = {}) {
	// do all insertions first, send in one insert batch
	const insertions = changes.filter((c) => c.action === 'insert').map((c) => ({ ...c, data: { ...c.data, ...args } }))
	const updates = changes.filter((c) => c.action === 'update')
	const deletions = changes.filter((c) => c.action === 'delete')

	const content_db_ids = _.chain(insertions).keyBy('id').value()

	if (insertions.length > 0) {
		// first, insert new entries

		await dataChanged({
			table: 'entries',
			action: 'insert',
			data: insertions.map((change) => {
				const omitted_props = ['id']
				const has_field_db_id_to_update = field_db_ids[change.data.field]
				if (has_field_db_id_to_update) omitted_props.push('field')
				const has_parent_db_id_to_update = content_db_ids[change.data.parent]
				if (has_parent_db_id_to_update) omitted_props.push('parent')
				return _.omit(change.data, omitted_props)
			})
		}).then((res) => {
			res.forEach(({ id: db_id }, i) => {
				const og_id = insertions[i].id
				content_db_ids[og_id] = db_id
			})
		})

		// then, update the entries' field & parent
		await Promise.all(
			insertions
				.filter(({ data }) => {
					const has_db_id_to_update = content_db_ids[data.parent] || field_db_ids[data.field]
					return has_db_id_to_update
				})
				.map(async ({ id, data }) => {
					const parent_db_id = content_db_ids[data.parent]
					const field_db_id = field_db_ids[data.field]
					await dataChanged({
						table: 'entries',
						action: 'update',
						id: content_db_ids[id],
						data: {
							...(parent_db_id ? { parent: parent_db_id } : {}),
							...(field_db_id ? { field: field_db_id } : {})
						}
					})
				})
		)
	}

	// then do everything else, referencing new ids and existing ids
	await Promise.all([
		...updates.map(async ({ action, id, data }) => {
			const parent_db_id = content_db_ids[data.parent] || data.parent
			const field_db_id = field_db_ids[data.field] || data.field
			await dataChanged({
				table: 'entries',
				action,
				id,
				data: {
					...data,
					...(parent_db_id ? { parent: parent_db_id } : {}),
					...(field_db_id ? { field: field_db_id } : {})
				}
			})
		}),
		...deletions.map(async ({ id }) =>
			dataChanged({
				table: 'entries',
				action: 'delete',
				id
			})
		)
	])

	return content_db_ids
}

// HELPERS
/**
 * Gets all ancestor items for a given item by recursively traversing parent relationships
 * 
 * @param {Object} item - The item to find ancestors for
 * @param {Array} all_items - Array of all possible items to search through
 * @param {string} item.parent - ID of the item's parent
 * @param {string} item.id - ID of the item
 * @returns {Array} Array of ancestor items, ordered from immediate parent to most distant ancestor
 */
export function get_ancestors(item, all_items) {
	const parent = all_items.find((e) => e.id === item.parent)
	return parent ? [parent, ...get_ancestors(parent, all_items)] : []
}

export function get_entry_field({ entry, entries, fields }) {
	return fields.find((field) => {
		if (entry.field) {
			return field.id === entry.field
		} else {
			const parent_entry = entries.find((e) => e.id === entry.parent)
			return field.id === parent_entry?.field
		}
	})
}


/**
 * Generates pages entry changes based on page type field changes.
 *
 * @param {Object} params - The parameters for generating changes.
 * @param {Array} params.page_entries - The current entries of the page.
 * @param {Array} params.field_changes - The changes made to the fields.
 * @param {Array} params.original_fields - The original fields before changes.
 * @param {Array} params.updated_fields - The updated fields after changes.
 * @returns {Object} An object containing the generated changes and updated entries.
 * @property {Array} changes - The generated changes to be applied to the section entries.
 * @property {Array} entries - The updated section entries after applying the changes.
 */
export function sync_page_content_with_field_changes({ page_entries, field_changes, original_fields, updated_fields }) {
	const new_fields = field_changes.filter((c) => c.action === 'insert').map((c) => c.data)

	function get_entry_field({ entry, entries, fields }) {
		return fields.find((field) => {
			if (entry.field) {
				return field.id === entry.field
			} else {
				const parent_entry = entries.find((e) => e.id === entry.parent)
				return field.id === parent_entry?.field
			}
		})
	}

	const deleted_page_entries = []
	const modified_page_entries = []
	const unmodified_page_entries = []
	for (const section_entry of page_entries) {
		const entry_field = get_entry_field({ entry: section_entry, entries: page_entries, fields: updated_fields })

		// if entry belongs to a field that no longer exists, delete it
		if (!entry_field) {
			deleted_page_entries.push(section_entry)
			continue
		}

		// TEST: delete container entries when their field type has changed
		// if entry field type has changed, modify and clear its value
		const original_field = get_entry_field({ entry: section_entry, entries: page_entries, fields: original_fields })
		if (original_field && original_field.type !== entry_field.type) {
			const modified_entry = {
				...section_entry,
				value: get_empty_value(entry_field)
			}
			modified_page_entries.push(modified_entry)
			continue
		}

		// keep all other entries
		unmodified_page_entries.push(section_entry)
	}

	// create new symbol entries based on new fields
	// we do this instead of looping through updated symbol entries because:
	// - we don't want to add new repeater container entries, or their children (i.e. empty entries)
	// - we don't want to add orphaned entries, in the case where we're adding a new child field to an existing repeater field and the section doesn't have any repeater container entries
	const new_page_entries = []
	for (const new_field of new_fields) {
		// if new field is the descendent of a new repeater field, don't add any entries
		const has_ancestor_repeater = get_ancestors(new_field, new_fields).some((f) => f.type === 'repeater')
		if (has_ancestor_repeater) {
			continue
		}

		// handle new root-level field (including groups)
		if (!new_field.parent) {
			const new_entry = Content_Row({ value: get_empty_value(new_field), field: new_field.id })
			new_page_entries.push(new_entry)
		}

		// handle repeater child
		// if new field's parent matches the field of one or more existing section repeater containers, create and add an entry for each container
		const existing_section_entry_parent_containers = unmodified_page_entries.filter((section_entry) => {
			const is_container = section_entry.index !== null
			const parent_entry = unmodified_page_entries.find((e) => e.id === section_entry.parent)
			return is_container && parent_entry.field === new_field.parent
		})
		if (existing_section_entry_parent_containers.length > 0) {
			const new_entries = existing_section_entry_parent_containers.map((container) => {
				return Content_Row({ value: get_empty_value(new_field), parent: container.id, field: new_field.id })
			})
			new_page_entries.push(...new_entries)
			continue
		}

    // handle group child - check both existing and newly created group entries
    const parent_group_entry = [...unmodified_page_entries, ...new_page_entries].find((section_entry) => {
			return section_entry.field && section_entry.field === new_field.parent
		})
		if (parent_group_entry) {
				const new_entry = Content_Row({ value: get_empty_value(new_field), parent: parent_group_entry.id, field: new_field.id })
				new_page_entries.push(new_entry)
				continue
		}
	}

	const page_entry_insertions = new_page_entries.map((entry) => ({
		action: 'insert',
		id: entry.id,
		data: _.cloneDeep(entry)
	}))

	const page_entry_updates = modified_page_entries.map((entry) => ({
		action: 'update',
		id: entry.id,
		data: { value: entry.value }
	}))

	const page_entry_deletions = deleted_page_entries.map((entry) => ({
		action: 'delete',
		id: entry.id
	}))

	const all_changes = [...page_entry_deletions, ...page_entry_updates, ...page_entry_insertions]

	const updated_entries = [...unmodified_page_entries, ...modified_page_entries, ...new_page_entries]

	return {
		changes: all_changes,
		entries: updated_entries
	}
}

/**
 * Generates section entries changes based on symbol changes.
 *
 * @param {Object} params - The parameters for generating changes.
 * @param {Array} params.section_entries - The current entries of the section.
 * @param {Array} params.field_changes - The changes made to the fields.
 * @param {Array} params.original_fields - The original fields before changes.
 * @param {Array} params.updated_fields - The updated fields after changes.
 * @returns {Object} An object containing the generated changes and updated entries.
 * @property {Array} changes - The generated changes to be applied to the section entries.
 * @property {Array} entries - The updated section entries after applying the changes.
 */
export function sync_section_content_with_field_changes({ section_entries, field_changes, original_fields, updated_fields }) {
	const new_fields = field_changes.filter((c) => c.action === 'insert').map((c) => c.data)

	function get_entry_field({ entry, entries, fields }) {
		return fields.find((field) => {
			if (entry.field) {
				return field.id === entry.field
			} else {
				const parent_entry = entries.find((e) => e.id === entry.parent)
				return field.id === parent_entry?.field
			}
		})
	}

	const deleted_section_entries = []
	const modified_section_entries = []
	const unmodified_section_entries = []
	for (const section_entry of section_entries) {
		const entry_field = get_entry_field({ entry: section_entry, entries: section_entries, fields: updated_fields })

		// if entry belongs to a field that no longer exists, delete it
		if (!entry_field) {
			deleted_section_entries.push(section_entry)
			continue
		}

		// TEST: delete container entries when their field type has changed
		// if entry field type has changed, modify and clear its value
		const original_field = get_entry_field({ entry: section_entry, entries: section_entries, fields: original_fields })
		if (original_field && original_field.type !== entry_field.type) {
			const modified_entry = {
				...section_entry,
				value: get_empty_value(entry_field)
			}
			modified_section_entries.push(modified_entry)
			continue
		}

		// keep all other entries
		unmodified_section_entries.push(section_entry)
	}

	// create new symbol entries based on new fields
	// we do this instead of looping through updated symbol entries because:
	// - we don't want to add new repeater container entries, or their children (i.e. empty entries)
	// - we don't want to add orphaned entries, in the case where we're adding a new child field to an existing repeater field and the section doesn't have any repeater container entries
	const new_section_entries = []
	for (const new_field of new_fields) {
		// if new field is the descendent of a new repeater field, don't add any entries
		const has_ancestor_repeater = get_ancestors(new_field, new_fields).some((f) => f.type === 'repeater')
		if (has_ancestor_repeater) {
			continue
		}

		// handle new root-level field (including groups)
		if (!new_field.parent) {
			const new_entry = Content_Row({ value: get_empty_value(new_field), field: new_field.id })
			new_section_entries.push(new_entry)
		}

		// handle repeater child
		// if new field's parent matches the field of one or more existing section repeater containers, create and add an entry for each container
		const existing_section_entry_parent_containers = unmodified_section_entries.filter((section_entry) => {
			const is_container = section_entry.index !== null
			const parent_entry = unmodified_section_entries.find((e) => e.id === section_entry.parent)
			return is_container && parent_entry.field === new_field.parent
		})
		if (existing_section_entry_parent_containers.length > 0) {
			const new_entries = existing_section_entry_parent_containers.map((container) => {
				return Content_Row({ value: get_empty_value(new_field), parent: container.id, field: new_field.id })
			})
			new_section_entries.push(...new_entries)
			continue
		}

    // handle group child - check both existing and newly created group entries
    const parent_group_entry = [...unmodified_section_entries, ...new_section_entries].find((section_entry) => {
			return section_entry.field && section_entry.field === new_field.parent
		})
		if (parent_group_entry) {
				const new_entry = Content_Row({ value: get_empty_value(new_field), parent: parent_group_entry.id, field: new_field.id })
				new_section_entries.push(new_entry)
				continue
		}
	}

	const section_content_insertions = new_section_entries.map((entry) => ({
		action: 'insert',
		id: entry.id,
		data: _.cloneDeep(entry)
	}))

	const section_content_updates = modified_section_entries.map((entry) => ({
		action: 'update',
		id: entry.id,
		data: { value: entry.value }
	}))

	const section_content_deletions = deleted_section_entries.map((entry) => ({
		action: 'delete',
		id: entry.id
	}))

	const all_changes = [...section_content_deletions, ...section_content_updates, ...section_content_insertions]

	const updated_entries = [...unmodified_section_entries, ...modified_section_entries, ...new_section_entries]

	return {
		changes: all_changes,
		entries: updated_entries
	}
}

/**
 * Generates changes for symbol entries based on updates to section entries and fields.
 *
 * @param {Object} params - The parameters for generating symbol entries changes.
 * @param {Array} params.original_symbol_entries - The original entries of the symbol.
 * @param {Array} params.original_symbol_fields - The original fields of the symbol.
 * @param {Array} params.updated_section_entries - The updated entries of the section.
 * @param {Array} params.section_content_changes - The changes made to the section entries.
 * @param {Array} params.updated_symbol_fields - The updated fields of the symbol.
 * @param {Array} params.field_changes - The changes made to the fields.
 * @returns {Object} An object containing the changes to be applied to the symbol entries.
 */
export function sync_symbol_content_with_section_changes({ original_symbol_entries, original_symbol_fields, updated_section_entries, section_content_changes, updated_symbol_fields, field_changes }) {
	const new_section_entries = section_content_changes.filter((c) => c.action === 'insert').map((c) => c.data)
	const new_fields = field_changes.filter((c) => c.action === 'insert').map((c) => c.data)

	const unmodified_symbol_entries = []
	const deleted_symbol_entries = []
	const modified_symbol_entries = []

	for (const symbol_entry of original_symbol_entries) {
		const updated_field = get_entry_field({ entry: symbol_entry, entries: original_symbol_entries, fields: updated_symbol_fields })

		// if entry belongs to a field that no longer exists, delete it
		if (!updated_field) {
			deleted_symbol_entries.push(symbol_entry)
			continue
		}

		// if entry field type has changed, modify and clear its value
		const original_field = get_entry_field({ entry: symbol_entry, entries: original_symbol_entries, fields: original_symbol_fields })
		if (original_field.type !== updated_field.type) {
			// delete container entries when their field type has changed
			if (original_field.type === 'repeater' && symbol_entry.index !== null) {
				deleted_symbol_entries.push(symbol_entry)
				continue
			}
			const modified_entry = {
				...symbol_entry,
				value: get_empty_value(updated_field)
			}
			modified_symbol_entries.push(modified_entry)
			continue
		}

		// keep all other entries
		unmodified_symbol_entries.push(symbol_entry)
	}

	const remaining_symbol_entries = [...unmodified_symbol_entries, ...modified_symbol_entries]

	let new_symbol_entries = []
	for (const section_entry of new_section_entries) {
		const new_field = get_entry_field({ entry: section_entry, entries: new_section_entries, fields: new_fields })

		// don't include entries belonging to an existing field
		if (!new_field) continue

		// include all root-level entries and descendents of new root-level entries
		const root_ancestor_is_new = get_ancestors(new_field, new_fields).some((field) => !field.parent)
		if (!new_field.parent || root_ancestor_is_new) {
			new_symbol_entries.push(_.cloneDeep(section_entry))
			continue
		}

		// handle existing repeater children
		const section_entry_parent = updated_section_entries.find((e) => e.id === section_entry.parent)
		const section_entry_parent_field = get_entry_field({ entry: section_entry_parent, entries: updated_section_entries, fields: updated_symbol_fields })
		const existing_symbol_entry_parent_container = remaining_symbol_entries.find((symbol_entry) => {
			const field = get_entry_field({ entry: symbol_entry, entries: remaining_symbol_entries, fields: updated_symbol_fields })
			const fields_match = field.id === section_entry_parent_field.id
			const indeces_match = section_entry_parent.index === symbol_entry.index
			return fields_match && indeces_match
		})
		if (existing_symbol_entry_parent_container) {
			new_symbol_entries.push({ ...section_entry, parent: existing_symbol_entry_parent_container.id })
			continue
		}

		// handle existing group child
		const existing_symbol_entry_parent_group_entry = remaining_symbol_entries.find((symbol_entry) => {
			return symbol_entry.field && symbol_entry.field === new_field.parent
		})
		if (existing_symbol_entry_parent_group_entry) {
			const new_entry = Content_Row({ value: get_empty_value(new_field), parent: existing_symbol_entry_parent_group_entry.id, field: new_field.id })
			new_symbol_entries.push(new_entry)
			continue
		}
	}

	// Ensure no symbol containers are missing children
	const existing_symbol_repeater_entries = remaining_symbol_entries.filter((entry) => entry.index !== null)
	for (const container_entry of existing_symbol_repeater_entries) {
		const field = get_entry_field({ entry: container_entry, entries: remaining_symbol_entries, fields: updated_symbol_fields })

		// Skip to the next container entry if it already has the new child entries
		const has_existing_child_entries = new_symbol_entries.some((entry) => entry.parent === container_entry.id)
		if (has_existing_child_entries) {
			continue
		}

		// Create a new entry for each missing child
		const child_fields = new_fields.filter((f) => f.parent === field.id)
		for (const child_field of child_fields) {
			const new_symbol_container_child_entry = Content_Row({
				field: child_field.id,
				parent: container_entry.id,
				value: get_empty_value(child_field)
			})
			new_symbol_entries.push(new_symbol_container_child_entry)
		}
	}

	// remap IDs to avoid conflicts with original section entries
	new_symbol_entries = remap_entry_ids(new_symbol_entries)

	const symbol_content_insertions = new_symbol_entries.map((entry) => ({
		action: 'insert',
		id: entry.id,
		data: _.cloneDeep(entry)
	}))

	const symbol_content_updates = modified_symbol_entries.map((entry) => ({
		action: 'update',
		id: entry.id,
		data: { value: entry.value }
	}))

	const symbol_content_deletions = deleted_symbol_entries.map((entry) => ({
		action: 'delete',
		id: entry.id
	}))

	return {
		changes: [...symbol_content_deletions, ...symbol_content_updates, ...symbol_content_insertions],
		entries: [...remaining_symbol_entries, ...new_symbol_entries]
	}
}


export function generate_sibling_section_changes({section_id = '', symbol_id, field_changes, original_fields, updated_fields}, sibling_sections = get_on_page_symbol_sections(symbol_id)) {

	const all_original_siblings = sibling_sections
			.filter((s) => s.id !== section_id)
			.map((s) => ({ id: s.id, entries: s.entries }))

	return all_original_siblings.map(({ id, entries }) => {
		const { changes, entries:updated_entries } = sync_section_content_with_field_changes({
			section_entries: entries,
			field_changes,
			original_fields,
			updated_fields
		})

		return {
			id,
			changes,
			entries: updated_entries
		}
	})
}

/**
 * Updates field changes with new IDs.
 *
 * @param {Array} changes - The array of field changes.
 * @param {Object} field_db_ids - An object mapping original field IDs to database IDs.
 * @returns {Array} The updated array of field changes with new IDs.
 */
export function update_field_changes_with_new_ids(changes, field_db_ids) {
	return changes.map(({ action, id, data }) => {
		// if (action !== 'insert') return { action, id, data }
		// keep this for inverted changes (which need to update for deleting recreated rows)
		const db_id = field_db_ids[id] || id
		const parent_db_id = field_db_ids[data?.parent] || data?.parent
		return {
			action,
			id: db_id,
			data: {
				...data,
				...(parent_db_id ? { parent: parent_db_id } : {}),
				id: db_id
			}
		}
	})
}

/**
 * Updates entries changes with new IDs.
 *
 * @param {Array} changes - The array of entries changes.
 * @param {Object} content_db_ids - An object mapping original entries IDs to database IDs.
 * @param {Object} field_db_ids - An object mapping original field IDs to database IDs.
 * @returns {Array} The updated array of entries changes with new IDs.
 */
export function update_content_changes_with_new_ids(changes, content_db_ids, field_db_ids = {}) {
	return changes.map(({ action, id, data }) => {
		// if (action !== 'insert') return { action, id, data }
		// keep this for inverted changes (which need to update for deleting recreated rows)
		const db_id = content_db_ids[id] || id
		const parent_db_id = content_db_ids[data?.parent] || data?.parent
		const field_db_id = field_db_ids[data?.field] || data?.field
		return {
			action,
			id: db_id,
			data: {
				...data,
				...(parent_db_id ? { parent: parent_db_id } : {}),
				...(field_db_id ? { field: field_db_id } : {}),
				id: db_id
			}
		}
	})
}

/**
 * Updates entries with new IDs.
 *
 * This function takes an array of entries entries and updates their IDs, parent IDs, and field IDs
 * based on the provided mapping objects. It's useful for synchronizing entries data with database IDs
 * after operations that may have changed these IDs.
 *
 * @param {Array<Object>} entries - The array of entries entries to update.
 * @param {Object<string, string> | {}} content_db_ids - An object mapping original entries IDs to database IDs.
 * @param {Object<string, string> | {}} field_db_ids - An object mapping original field IDs to database IDs.
 * @returns {Array<Object>} The updated array of entries entries with new IDs.
 */
export function update_content_with_new_ids(entries, content_db_ids, field_db_ids = {}) {
	return entries.map((entry) => ({
		...entry,
		id: content_db_ids[entry.id] || entry.id,
		parent: content_db_ids[entry.parent] || entry.parent,
		field: field_db_ids[entry.field] || entry.field
	}))
}



export function update_entry_changes_with_new_field_ids(changes, field_id_map) {
	return changes.map(({ action, id, data }) => {
		const field_id = field_id_map[data?.field] || data?.field
		return {
			action,
			id,
			data: {
				...data,
				...(field_id ? { field: field_id } : {}),
			}
		}
	})
}

export function update_entries_with_new_field_ids(entries, field_id_map) {
	return entries.map((entry) => ({
		...entry,
		field: field_id_map[entry.field] || entry.field
	}))
}

/**
 * Updates fields with new IDs.
 *
 * This function takes an array of field objects and updates their IDs and parent IDs
 * based on the provided mapping object. It's useful for synchronizing field data with database IDs
 * after operations that may have changed these IDs.
 *
 * @param {Array<Object>} fields - The array of field objects to update.
 * @param {Object<string, string> | Object} field_db_ids - An object mapping original field IDs to database IDs.
 * @returns {Array<Object>} The updated array of field objects with new IDs.
 */
export function update_fields_with_new_ids(fields, field_db_ids) {
	return fields.map((field) => ({
		...field,
		id: field_db_ids[field.id] || field.id,
		parent: field_db_ids[field.parent] || field.parent
	}))
}
