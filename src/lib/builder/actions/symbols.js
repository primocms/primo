import { cloneDeep } from 'lodash-es'
import _ from 'lodash-es'
import {v4 as uuid} from 'uuid'
import { get } from 'svelte/store'
import stores, { update_timeline } from '$lib/builder/stores/data'
import { site } from '$lib/builder/stores/data/site'
import { dataChanged } from '$lib/builder/database'
import * as helpers from './_helpers'
import * as db_helpers from '$lib/builder/actions/_db_helpers'
import * as db_utils from './_db_utils'
import { Symbol } from '$lib/builder/factories'
import { update_page_file, update_symbol_file } from './_storage_helpers'
import { get_on_page_symbol_sections } from '$lib/builder/stores/helpers'
import { remap_entries_and_fields } from './_db_utils'

/**
 * Adds a block to the site.
 *
 * @param {Object} options
 * @param {Object} options.symbol - The symbol object representing the block to be added.
 * @param {number} options.index - The index at which to insert the block.
 * @returns {Promise<void>}
 */
export async function add_block_to_site({ symbol, index }) {
	let created_symbol_db_id

	await update_timeline({
		doing: async () => {
			const new_block = await create_block({
				name: symbol.name,
				code: symbol.code,
				entries: symbol.entries.filter(e => !e.page && !e.site),
				fields: symbol.fields,
				index
			})
			created_symbol_db_id = new_block.id

			await insert_block(new_block)
		},
		undoing: async () => {
			await delete_block(created_symbol_db_id)
		}
	})
}

export async function delete_block_from_site(block) {
	let active_block_id = block.id
	await update_timeline({
		doing: async () => {
			await delete_block(active_block_id)
			update_page_file()
		},
		undoing: async () => {
			const new_block = await create_block({
				name: block.name,
				code: block.code,
				index: block.index,
				entries: block.entries,
				fields: block.fields
			})
			active_block_id = new_block.id

			await insert_block(new_block)
			update_page_file()
		}
	})
}


export async function add_multiple_symbols(symbols) {
	let created_symbol_db_id

	await update_timeline({
		doing: async () => {

			const remapped_symbols = symbols.map(symbol => {
				const new_id = uuid()
				const remapped_symbol = _.cloneDeep({
					...symbol,
					id: new_id
				})
				db_utils.remap_entry_and_field_items({
					fields: remapped_symbol.fields,
					entries: remapped_symbol.entries
				})
				return {
					...remapped_symbol,
					index: 0,
					id: new_id,
				}
			})

			stores.symbols.update(store => [...store, ...remapped_symbols])

			await dataChanged({
				table: 'symbols',
				action: 'insert',
				data: remapped_symbols.map(s => _.omit(s, ['entries', 'fields']))
			})


			const fields = remapped_symbols.flatMap(s => s.fields.map(f => ({ ...f, symbol: s.id, library_symbol: null })))
			const entries = remapped_symbols.flatMap(s => s.entries.map(e => ({ ...e, symbol: s.id, library_symbol: null })))

			await dataChanged({
				table: 'fields',
				action: 'insert',
				data:fields
			})
			await dataChanged({
				table: 'entries',
				action: 'insert',
				data:entries
			})
		},
		undoing: async () => {
			await delete_block(created_symbol_db_id)
		}
	})
}



/**
 * Updates a block with new data and handles changes to its fields and entries.
 * This function also synchronizes entries changes across all instances of the block (section siblings),
 * and updates the data with database IDs in both the doing() and undoing() methods.
 *
 * @async
 * @param {Object} params - The parameters for updating the block.
 * @param {Object} params.block - The original block object to be updated.
 * @param {Object} params.updated_data - The new data to update the block with.
 * @param {string} params.updated_data.code - The updated code for the block.
 * @param {Array} params.updated_data.fields - The updated fields for the block.
 * @param {Array} params.updated_data.entries - The updated entries for the block.
 * @returns {Promise<void>}
 *
 * @description
 * In the doing() method:
 * - Updates the block's code in the database if changed.
 * - Handles field and entries changes, updating the database and obtaining new database IDs.
 * - Updates `updated_fields`, `updated_entries`, and changes with the new database IDs.
 * - Synchronizes changes across all instances of the block (i.e. section siblings).
 *
 * In the undoing() method:
 * - Reverts changes made in the doing() method.
 * - Recreates deleted fields and entries, obtaining new database IDs.
 * - Updates the reverted data and intial changes with the new database IDs so.
 *
 * This ensures that all data is consistent with the database state in both forward and backward operations.
 * Especially when deleting entries/fields, since they're recreated in undoing() and need to be refereced correctly in doing()
 */
export async function update_block({ block, updated_data }) {

	const original_code = block.code
	let original_fields = _.cloneDeep(block.fields)
	let original_entries = _.cloneDeep(block.entries)

	const updated_code = updated_data.code
	let updated_fields = _.cloneDeep(updated_data.fields)
	let updated_entries = _.cloneDeep(updated_data.entries.filter(e => !e.site && !e.page && !e.page_type))

	let content_changes = db_utils.generate_entry_changes(original_entries, updated_entries)
	let field_changes = db_utils.generate_field_changes(original_fields, updated_fields)

	const local_sections = helpers.generate_sibling_section_changes({ symbol_id: block.id, field_changes, original_fields, updated_fields })
	let foreign_sections = [] // fetch and assign below to avoid delay

	await update_timeline({
		doing: async () => {

			// remap IDs for new items (necessary to refresh IDs when doing() after undoing())
			db_utils.remap_entries_and_fields({
				changes: {
					fields: field_changes,
					entries: [...content_changes, ...local_sections.flatMap(s => s.changes)]
				},
				items: {
					fields: updated_fields,
					entries: [...updated_entries, ...local_sections.flatMap(s => s.entries)]
				}
			})

			// STORE: update code, symbol fields & entries locally w/ DB IDs
			store_actions.update_symbol(block.id, {
				fields: updated_fields,
				entries: updated_entries,
				code: updated_code
			})

			// STORE: update on-page sections' entries
			for (const { id, entries } of local_sections) {
				store_actions.update_section(id, { entries })
			}

			// DB: save block code if changed
			if (!_.isEqual(original_code, updated_code)) {
				await db_actions.update_block(block.id, { code: updated_code })
			}

			// DB: save Symbol fields
			await helpers.handle_field_changes_new(field_changes, {
				symbol: block.id
			})

			// DB: save Symbol entries
			await helpers.handle_content_changes_new(content_changes, {
				symbol: block.id
			})

			// DB: update Symbol Sections
			if (content_changes.length > 0) {
				await Promise.all(
					local_sections.map(({ id, changes }) => 
						helpers.handle_content_changes_new(changes, {
							section: id
						})
					)
				)

				const fetched_foreign_sections = await db_helpers.get_symbol_sections(block.id)
				foreign_sections = helpers.generate_sibling_section_changes({
					symbol_id: block.id,
					field_changes: field_changes,
					original_fields,
					updated_fields
				}, fetched_foreign_sections)

				await Promise.all(
					foreign_sections.map(({ id, changes }) => 
						helpers.handle_content_changes_new(changes, {
							section: id
						})
					)
				)
			}

			update_symbol_file(get(stores.symbols).find(s => s.id === block.id))
		},
		undoing: async () => {

			// DOING: this is too complicated, just replace it with what I was doing before: 
			// use generate_inverse_changes, return the id_map for the fields, and pass it to subsequent generate_inverse_changes/content


			const { changes:inverted_field_changes, fields:restored_fields, map } = db_utils.generate_inverted_field_changes(field_changes, original_fields)

			const { changes:inverted_entry_changes, entries:restored_entries } = db_utils.generate_inverted_entry_changes(content_changes, original_entries, map)
			const all_inverted_local_section_entries = local_sections.map(({ changes, entries }) => db_utils.generate_inverted_entry_changes(changes, entries, map))
			const all_inverted_foreign_section_entries = foreign_sections.map(({ changes, entries }) => db_utils.generate_inverted_entry_changes(changes, entries, map))

			// STORE: update the local sections w/ the original and recreated items
			all_inverted_local_section_entries.forEach((entries, i) => {
				const section_id = local_sections[i].id
				store_actions.update_section(section_id, { entries })
			})


			// STORE: update symbol code, fields, and entries
			store_actions.update_symbol(block.id, {
				fields: restored_fields,
				entries: restored_entries,
				code: original_code
			})


			// DB: restore symbol code
			if (!_.isEqual(original_code, updated_code)) {
				db_actions.update_block(block.id, { code: original_code })
			}

			// DB: restore symbol fields
			await helpers.handle_field_changes_new(inverted_field_changes, { symbol: block.id })


			// DB: revert Symbol and Sections entry changes
			await Promise.all([
				helpers.handle_content_changes_new(inverted_entry_changes, { symbol: block.id }),
				...all_inverted_local_section_entries.map((section, i) => {
					const section_id = local_sections[i].id
					return helpers.handle_content_changes_new(section.changes, { section: section_id })
				}),
			])


			// DB: Reverse foreign sibling section changes
			if (inverted_entry_changes.length > 0) {
				await Promise.all(
					all_inverted_foreign_section_entries.map(async ({ changes, entries }, i) => {
						const section_id = foreign_sections[i].id
						const [ inverted_sibling_entry_changes ] = db_utils.generate_inverted_changes(changes, entries)
						await helpers.handle_content_changes_new(inverted_sibling_entry_changes, {
							section: section_id
						})
					})
				)
			}

			original_fields = restored_fields
			original_entries = restored_entries

			update_symbol_file(get(stores.symbols).find(s => s.id === block.id))
		}
	})
}

export async function rename_block({ block, name }) {
	await update_timeline({
		doing: async () => {
			store_actions.update_symbol(block.id, { name })
			db_actions.update_block(block.id, { name })
		},
		undoing: async () => {
			store_actions.update_symbol(block.id, { name })
			db_actions.update_block(block.id, { name: block.name })
		}
	})
}

export async function move_block(block_being_moved, new_position) {
	const original_symbols = cloneDeep(get(stores.symbols))
	const blocks_without_block_being_moved = cloneDeep(get(stores.symbols)).filter((s) => s.id !== block_being_moved.id)
	const updated_blocks = [...blocks_without_block_being_moved.slice(0, new_position), block_being_moved, ...blocks_without_block_being_moved.slice(new_position)].map((s, i) => ({ ...s, index: i }))

	await update_timeline({
		doing: async () => {
			stores.symbols.set(updated_blocks)
			await Promise.all([updated_blocks.map((block) => db_actions.update_block(block.id, { index: block.index }))])
		},
		undoing: async () => {
			stores.symbols.set(original_symbols)
			await Promise.all([original_symbols.map((block) => db_actions.update_block(block.id, { index: block.index }))])
		}
	})
}

// HELPERS
async function create_block({ name = '', code, entries, fields, index }) {
	const insertions = {
		entries: entries.map((e) => ({ action: 'insert', id: e.id, data: e })),
		fields: fields.map((e) => ({ action: 'insert', id: e.id, data: e }))
	}

	// DB: insert symbol with entries & fields
	const created_symbol_db_id = await dataChanged({
		table: 'symbols',
		action: 'insert',
		data: {
			name,
			code,
			index,
			owner_site: get(site).id
		}
	})

	const field_db_ids = await helpers.handle_field_changes(insertions.fields, { symbol: created_symbol_db_id })
	const content_db_ids = await helpers.handle_content_changes(insertions.entries, field_db_ids, { symbol: created_symbol_db_id })

	const new_block = Symbol({
		id: created_symbol_db_id,
		name,
		code,
		index,
		entries: entries.map((entry) => ({
			...entry,
			id: content_db_ids[entry.id],
			parent: content_db_ids[entry.parent],
			field: field_db_ids[entry.field]
		})),
		fields: fields.map((field) => ({
			...field,
			id: field_db_ids[field.id],
			parent: field_db_ids[field.parent]
		}))
	})

	return new_block
}

async function insert_block(block) {
	const original_blocks = _.cloneDeep(get(stores.symbols))
	const updated_blocks = [...original_blocks.slice(0, block.index), block, ...original_blocks.slice(block.index)].map((s, i) => ({ ...s, index: i }))

	// STORE: set updated blocks
	stores.symbols.set(updated_blocks)

	// DB: update palette section indeces
	await Promise.all(updated_blocks.map((s) => db_actions.update_block(s.id, { index: s.index })))
}

async function delete_block(block_id) {
	const original_blocks = _.cloneDeep(get(stores.symbols))
	const new_blocks = original_blocks
		.filter((block) => block.id !== block_id)
		.map((block, i) => ({
			...block,
			index: i
		}))

	stores.symbols.set(new_blocks)
	await dataChanged({ table: 'symbols', action: 'delete', id: block_id })
	await Promise.all(new_blocks.map((s) => db_actions.update_block(s.id, { index: s.index })))
}

// DB ACTIONS
const db_actions = {
	update_block: async (block_id, updated_block_props) => {
		await dataChanged({
			table: 'symbols',
			action: 'update',
			id: block_id,
			data: updated_block_props
		})
	}
}

// STORE ACTIONS
const store_actions = {
	/**
	 * Updates a section in the sections store.
	 *
	 * @param {string} section_id - The ID of the section to update.
	 * @param {Object} updated_section_props - An object containing the properties to update.
	 * @returns {void}
	 */
	update_section: (section_id, updated_section_props) => {
		stores.sections.update((store) =>
			store.map((section) => {
				if (section.id === section_id) {
					return {
						...section,
						...updated_section_props
					}
				} else return section
			})
		)
	},
	/**
	 * Updates a symbol in the symbols store.
	 *
	 * @param {string} symbol_id - The ID of the symbol to update.
	 * @param {Object} updated_symbol_props - An object containing the properties to update.
	 * @returns {void}
	 */
	update_symbol: (symbol_id, updated_symbol_props) => {
		stores.symbols.update((store) =>
			store.map((symbol) => {
				if (symbol.id === symbol_id) {
					return {
						...symbol,
						...updated_symbol_props
					}
				} else return symbol
			})
		)
	}
}
