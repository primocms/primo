import _ from 'lodash-es'
import { get } from 'svelte/store'
import stores, { update_timeline } from '$lib/builder/stores/data'
import { update as update_site } from '$lib/builder/stores/data/site'
import { dataChanged } from '$lib/builder/database'
import { swap_array_item_index } from '$lib/builder/utilities'
import { get_symbol, get_section } from '$lib/builder/stores/helpers'
import * as helpers from '$lib/builder/actions/_helpers'
import * as db_helpers from '$lib/builder/actions/_db_helpers'
import * as db_utils from '$lib/builder/actions/_db_utils'
import { update_page_file, update_symbol_file } from './_storage_helpers'
import { Section } from '$lib/builder/factories'
import active_page_store from '$lib/builder/stores/data/page'

export async function add_section_to_palette({ palette_id, symbol, position }) {
	let new_section_db_id
	await update_timeline({
		doing: async () => {
			// const new_section = await create_section({
			// 	index: position,
			// 	symbol_id: symbol.id,
			// 	palette_id,
			// 	page_id: get(active_page_store).id,
			// 	entries: symbol.entries
			// })
			// await insert_palette_section(new_section)
			// new_section_db_id = new_section.id
			new_section_db_id = await create_and_insert_section({
				index: position,
				symbol_id: symbol.id,
				palette_id,
				page_id: get(active_page_store).id,
				entries: symbol.entries
			})
			update_page_file()
		},
		undoing: async () => {
			await delete_palette_section(new_section_db_id)
			update_page_file()
		}
	})
	return new_section_db_id
}

export async function delete_section_from_palette(section_id) {
	let section_to_delete = section_id
	const original_section = get_section(section_id)

	await update_timeline({
		doing: async () => {
			await delete_palette_section(section_to_delete)
			update_page_file()
		},
		undoing: async () => {
			section_to_delete = await create_and_insert_section({
				index: original_section.index,
				symbol_id: original_section.symbol,
				palette_id: original_section.palette,
				page_id: original_section.page,
				entries: original_section.entries
			})
			update_page_file()
		}
	})
}

export async function move_section(block_being_moved, to) {
	const block_being_replaced = _.find(get(stores.sections), ['index', to])
	const original_sections = _.cloneDeep(get(stores.sections))
	const updated_sections = swap_array_item_index(original_sections, block_being_moved.index, to).map((section) => {
		if (section.id === block_being_moved.id) {
			return {
				...section,
				index: to
			}
		} else if (section.id === block_being_replaced?.id) {
			return {
				...section,
				index: block_being_moved.index
			}
		} else return section
	})

	await update_timeline({
		doing: async () => {
			stores.sections.set(updated_sections)
			if (!block_being_replaced) return
			await Promise.all([
				dataChanged({
					table: 'sections',
					action: 'update',
					id: block_being_replaced.id,
					data: { index: block_being_moved.index }
				}),
				dataChanged({
					table: 'sections',
					action: 'update',
					id: block_being_moved.id,
					data: { index: to }
				})
			])
			update_page_file()
		},
		undoing: async () => {
			stores.sections.set(original_sections)
			await Promise.all([
				dataChanged({
					table: 'sections',
					action: 'update',
					id: block_being_replaced.id,
					data: { index: block_being_replaced.index }
				}),
				dataChanged({
					table: 'sections',
					action: 'update',
					id: block_being_moved.id,
					data: { index: block_being_moved.index }
				})
			])
			update_page_file()
		}
	})
}

/**
 * Updates a section with new data, syncronizes symbol updates, and applies changes
 *
 * @async
 * @param {string} section_id - The ID of the section to update.
 * @param {Object} options - The options for updating the section.
 * @param {Object} options.updated_data - The updated data for the section.
 * @param {Object} options.changes - The changes to apply to the section.
 * @returns {Promise<void>}
 */
export async function update_section(section_id, { updated_data, changes }) {

	// Section
	const original_section = get_section(section_id)
	let original_section_entries = _.cloneDeep(original_section.entries)
	let updated_section_entries = _.cloneDeep(updated_data.entries.filter(e => !e.page && !e.site && !e.page_type))
	let section_content_changes = _.cloneDeep(changes.entries.filter(c => !c.dynamic))

	// Site entries changes
	let original_site_entries = _.cloneDeep(get(stores.site).entries)
	let updated_site_entries = _.cloneDeep(updated_data.entries.filter(e => e.site))
	let site_content_changes = _.cloneDeep(changes.entries.filter(c => c.dynamic === 'site'))

	// Page entries changes
	let original_page_entries = _.cloneDeep(get(active_page_store).entries)
	let updated_page_entries = _.cloneDeep(updated_data.entries.filter(e => e.page))
	let page_content_changes = _.cloneDeep(changes.entries.filter(c => c.dynamic === 'page'))

	// TODO: Page Type entries changes
	let original_page_type_entries = _.cloneDeep(get(active_page_store).entries)
	let updated_page_type_entries = _.cloneDeep(updated_data.entries.filter(e => e.page))
	let page_type_content_changes = _.cloneDeep(changes.entries.filter(c => c.dynamic === 'page-type'))

	// Symbol
	const symbol_id = original_section.symbol || original_section.master?.symbol
	const original_symbol = get_symbol(symbol_id)
	let symbol_field_changes = _.cloneDeep(changes.fields)
	let { changes: symbol_content_changes, entries: updated_symbol_entries } = helpers.sync_symbol_content_with_section_changes({
		original_symbol_entries: original_symbol.entries,
		original_symbol_fields: original_symbol.fields,
		updated_section_entries,
		updated_symbol_fields: updated_data.fields,
		section_content_changes: section_content_changes,
		field_changes: changes.fields
	})
	let updated_symbol_fields = _.cloneDeep(updated_data.fields)
	const updated_symbol_code = updated_data.code

	let local_sibling_sections = helpers.generate_sibling_section_changes({
		section_id,
		symbol_id,
		field_changes: symbol_field_changes,
		original_fields: original_symbol.fields,
		updated_fields: updated_symbol_fields
	})
	let foreign_sibling_sections = [] // fetch and assign below to avoid delay

	await update_timeline({
		doing: async () => {

			// remap IDs for new items (necessary to refresh IDs when doing() after undoing())
			db_utils.remap_entries_and_fields({
				changes: {
					fields: symbol_field_changes,
					entries: [...section_content_changes, ...symbol_content_changes, ...local_sibling_sections.flatMap(s => s.changes)]
				},
				items: {
					fields: updated_symbol_fields,
					entries: [...updated_section_entries, ...updated_symbol_entries, ...local_sibling_sections.flatMap(s => s.entries)]
				}
			})
			if (page_content_changes.length > 0) {
				db_utils.remap_entries_and_fields({
					changes: {
						fields: [],
						entries: page_content_changes
					},
					items: {
						fields: [],
						entries: updated_page_entries
					}
				})
			}
			if (site_content_changes.length > 0) {
				db_utils.remap_entries_and_fields({
					changes: {
						fields: [],
						entries: site_content_changes
					},
					items: {
						fields: [],
						entries: updated_site_entries
					}
				})
			}

			// STORE: update Section entries
			store_actions.update_section(section_id, { entries: updated_section_entries })

			// STORE: update sibling Sections entries
			local_sibling_sections.forEach(({ id, entries }) => {
				store_actions.update_section(id, { entries })
			})

			// STORE: update Site entries
			if (site_content_changes.length > 0) {
				update_site({ entries: updated_site_entries })
			}

			// STORE: update Page entries
			if (page_content_changes.length > 0) {
				active_page_store.update(store => ({
					...store,
					entries: updated_page_entries
				}))
			}

			// STORE: update Symbol code, fields & entries
			store_actions.update_symbol(symbol_id, {
				fields: updated_symbol_fields,
				entries: updated_symbol_entries,
				code: updated_symbol_code
			})

			// DB: save Symbol code if changed
			if (!_.isEqual(original_symbol.code, updated_symbol_code)) {
				db_actions.update_symbol(symbol_id, { code: updated_symbol_code })
				update_symbol_file(get(stores.symbols).find(s => s.id === symbol_id))
			}

			// DB: save Symbol fields
			await helpers.handle_field_changes_new(symbol_field_changes, {
				symbol: symbol_id
			})

			// DB: save Section, Symbol, Site, and Page entries
			await Promise.all([
				helpers.handle_content_changes_new(section_content_changes, {
					section: section_id
				}),
				helpers.handle_content_changes_new(symbol_content_changes, {
					symbol: symbol_id
				}),
				helpers.handle_content_changes_new(site_content_changes, { site: get(stores.site).id}),
				helpers.handle_content_changes_new(page_content_changes, { page: get(active_page_store).id})
			])


			// DB: Update sibling Sections (only relevant is symbol entries have changes)
			if (symbol_content_changes.length > 0) {
				await Promise.all(
					local_sibling_sections.map(({ id, changes }) => 
						helpers.handle_content_changes_new(changes, {
							section: id
						})
					)
				)

				const fetched_foreign_sibling_sections = await db_helpers.get_off_page_sibling_sections(section_id, symbol_id)
				foreign_sibling_sections = helpers.generate_sibling_section_changes({
					section_id,
					symbol_id,
					field_changes: symbol_field_changes,
					original_fields: original_symbol.fields,
					updated_fields: updated_symbol_fields
				}, fetched_foreign_sibling_sections)

				await Promise.all(
					foreign_sibling_sections.map(({ id, changes }) => 
						helpers.handle_content_changes_new(changes, {
							section: id
						})
					)
				)
			}

			update_page_file(site_content_changes.length > 0)
		},
		undoing: async () => {
			// Generate inverted changes
			const [ inverted_section_entry_changes, restored_section_entries ] = db_utils.generate_inverted_changes(section_content_changes, original_section_entries)
			
			const inverted_siblings = local_sibling_sections.map(sibling => {
				const [inverted_sibling_entry_changes, restored_sibling_entries] = db_utils.generate_inverted_changes(sibling.changes, sibling.entries)
				return { id: sibling.id, changes: inverted_sibling_entry_changes, entries: restored_sibling_entries}
			})

			const [ inverted_field_changes, restored_fields ] = db_utils.generate_inverted_changes(symbol_field_changes, original_symbol.fields)
			const [ inverted_symbol_entry_changes, restored_symbol_entries ] = db_utils.generate_inverted_changes(symbol_content_changes, original_symbol.entries)
			const [ inverted_site_entry_changes, restored_site_entries ] = db_utils.generate_inverted_changes(site_content_changes, original_site_entries)
			const [ inverted_page_entry_changes, restored_page_entries ] = db_utils.generate_inverted_changes(page_content_changes, original_page_entries)

			// STORE: restore section entries
			store_actions.update_section(section_id, { entries: original_section_entries })

			// STORE: restore on-page section entries
			inverted_siblings.forEach(sibling => 
				store_actions.update_section(sibling.id, { entries: sibling.entries })
			)

			// STORE: restore symbol fields, entries, and code
			store_actions.update_symbol(symbol_id, {
				fields: restored_fields,
				entries: restored_symbol_entries,
				code: original_symbol.code
			})

			// STORE: restore Site entries
			update_site({ entries: restored_site_entries })

			// STORE: restore Page entries
			active_page_store.update(store => ({
				...store,
				entries: restored_page_entries
			}))

			// DB: restore symbol code if changed
			if (!_.isEqual(original_symbol.code, updated_data.code)) {
				update_symbol_file(get(stores.symbols).find(s => s.id === symbol_id))
				db_actions.update_symbol(original_symbol.id, { code: original_symbol.code })
			}

			// DB: restore symbol fields
			await helpers.handle_field_changes_new(inverted_field_changes, { symbol: symbol_id })

			// DB: revert section, sibling, symbol, page, and site entry changes
			await Promise.all([
				helpers.handle_content_changes_new(inverted_section_entry_changes, { section: section_id }),
				...inverted_siblings.map(sibling => 
					helpers.handle_content_changes_new(sibling.changes, { section: sibling.id }),
				),
				helpers.handle_content_changes_new(inverted_symbol_entry_changes, { symbol: symbol_id }),
				helpers.handle_content_changes_new(inverted_site_entry_changes, { site: get(stores.site).id }),
				helpers.handle_content_changes_new(inverted_page_entry_changes, { page: get(active_page_store).id })
			])

			// DB: Reverse foreign sibling section changes
			if (inverted_symbol_entry_changes.length > 0) {
				await Promise.all(
					foreign_sibling_sections.map(async ({ id, changes, entries }) => {
						const [ inverted_sibling_entry_changes ] = db_utils.generate_inverted_changes(changes, entries)
						await helpers.handle_content_changes_new(inverted_sibling_entry_changes, {
							section: id
						})
					})
				)
			}

			// restore original fields and entries (necessary for doing() w/ recreated items w/ new IDs)
			original_symbol.fields = restored_fields
			original_symbol.entries = restored_symbol_entries
			original_section_entries = restored_section_entries
			original_site_entries = restored_site_entries
			original_page_entries = restored_page_entries
		
			update_page_file(site_content_changes.length > 0)
		}
	})
}

// extract symbol/instance entries from updated section entries
export async function update_section_entries({ id, value }) {
	const original_sections = _.cloneDeep(get(stores.sections))
	const updated_sections = _.cloneDeep(
		original_sections.map((section) => {
			const relevant_entry = section.entries.find((e) => e.id === id)
			if (relevant_entry) {
				const updated_entry = { ...relevant_entry, value }
				const updated_entries = section.entries.map((e) => (e.id === id ? updated_entry : e))
				return { ...section, entries: updated_entries }
			} else return section
		})
	)
	stores.sections.set(updated_sections)

	// DB
	await dataChanged({
		table: 'entries',
		action: 'update',
		id,
		data: { value }
	})
	update_page_file()
}

//////////////////////////////////
// HELPERS ///////////////////////
//////////////////////////////////

/**
 * Inserts a new section into the database and returns its ID.
 *
 * @param {Object} params
 * @param {number} params.index - The index of the new section.
 * @param {string} params.symbol_id - The ID of the symbol associated with the section.
 * @param {string} params.palette_id - The ID of the palette the section belongs to.
 * @param {Array} params.entries - The entries of the section.
 * @param {string} params.page_id - The ID of the page the section belongs to.
 * @returns {Promise<string>} The newly inserted section's ID.
 */
async function create_and_insert_section({ index, symbol_id, palette_id, entries, page_id }) {
	// create new section object
	const new_section = Section({
		index,
		page: page_id,
		palette: palette_id,
		symbol: symbol_id,
		entries: db_utils.remap_entry_ids(entries)
	})

	// STORE: set updated sections
	const original_sections = _.cloneDeep(get(stores.sections))
	const original_palette_sections = original_sections.filter((s) => s.palette === new_section.palette).sort((a, b) => a.index - b.index)
	const updated_palette_sections = [...original_palette_sections.slice(0, new_section.index), new_section, ...original_palette_sections.slice(new_section.index)].map((s, i) => ({ ...s, index: i }))
	const updated_sections = original_sections.flatMap((section) => {
		if (section.palette) {
			const updated_palette_section = updated_palette_sections.find((s) => s.id === section.id)
			return updated_palette_section
		} else return section
	})
	updated_sections.push(new_section)
	stores.sections.set(updated_sections)

	// DB: insert new section
	await dataChanged({
		table: 'sections',
		action: 'insert',
		data: _.omit(new_section, ['entries'])
	})

	// DB: insert section entries
	await dataChanged({
		table: 'entries',
		action: 'insert',
		data: new_section.entries.map(e => ({ ...e, symbol: null, section: new_section.id }))
	})

	// DB: update palette section indeces
	await Promise.all(
		updated_palette_sections.map((s) =>
			dataChanged({
				table: 'sections',
				action: 'update',
				id: s.id,
				data: { index: s.index }
			})
		)
	)

	return new_section.id
}



/**
 * Inserts a new section into the database and returns its ID.
 *
 * @param {Object} params
 * @param {number} params.index - The index of the new section.
 * @param {string} params.symbol_id - The ID of the symbol associated with the section.
 * @param {string} params.palette_id - The ID of the palette the section belongs to.
 * @param {Array} params.entries - The entries of the section.
 * @param {string} params.page_id - The ID of the page the section belongs to.
 * @returns {Promise<object>} The newly inserted section.
 */
async function create_section({ index, symbol_id, palette_id, entries, page_id }) {
	// create new section object
	const new_section = Section({
		index,
		page: page_id,
		palette: palette_id,
		symbol: symbol_id,
		entries // will update w/ DBIDs
	})

	// DB: insert new section
	const new_section_db_id = await dataChanged({
		table: 'sections',
		action: 'insert',
		data: _.pick(new_section, ['index', 'symbol', 'palette', 'page'])
	})
	new_section.id = new_section_db_id

	// DB: insert entries entries
	const content_db_ids = await helpers.handle_content_changes(
		entries.map((data) => ({
			action: 'insert',
			id: data.id,
			data: {
				..._.omit(data, ['symbol']),
				section: new_section_db_id
			}
		})),
		[]
	)
	new_section.entries = new_section.entries.map((row) => ({
		...row,
		id: content_db_ids[row.id],
		parent: content_db_ids[row.parent]
	}))

	return new_section
}

/**
 * Inserts a new section into the palette and updates the indices of existing sections.
 *
 * @param {Object} section - The new section to be inserted.
 * @param {string} section.id - The ID of the new section.
 * @param {number} section.index - The index where the new section should be inserted.
 * @param {string} section.palette - The ID of the palette where the section should be inserted.
 * @returns {Promise<void>}
 */
async function insert_palette_section(section) {
	// insert new_section to page sections at given index, set other indeces accordingly
	const original_sections = _.cloneDeep(get(stores.sections))
	const original_palette_sections = original_sections.filter((s) => s.palette === section.palette).sort((a, b) => a.index - b.index)

	const updated_palette_sections = [...original_palette_sections.slice(0, section.index), section, ...original_palette_sections.slice(section.index)].map((s, i) => ({ ...s, index: i }))
	const updated_sections = original_sections.flatMap((section) => {
		if (section.palette) {
			const updated_palette_section = updated_palette_sections.find((s) => s.id === section.id)
			return updated_palette_section
		} else return section
	})
	updated_sections.push(section)

	// STORE: set updated sections
	stores.sections.set(updated_sections)

	// DB: update palette section indeces
	await Promise.all(
		updated_palette_sections.map((s) =>
			dataChanged({
				table: 'sections',
				action: 'update',
				id: s.id,
				data: { index: s.index }
			})
		)
	)
}

async function delete_palette_section(section_id) {
	const original_sections = _.cloneDeep(get(stores.sections))

	const new_palette_sections = original_sections
		.filter((s) => s.palette)
		.filter((s) => s.id !== section_id)
		.map((s, i) => ({ ...s, index: i }))

	const new_sections = original_sections
		.map((section) => {
			const updated_palette_section = new_palette_sections.find((s) => s.id === section.id)
			return updated_palette_section || section
		})
		.filter((section) => section.id !== section_id)

	stores.sections.set(new_sections)
	await dataChanged({ table: 'sections', action: 'delete', id: section_id })
	await Promise.all(
		new_palette_sections.map((s) =>
			dataChanged({
				table: 'sections',
				action: 'update',
				id: s.id,
				data: { index: s.index }
			})
		)
	)
}

// DB ACTIONS
const db_actions = {
	update_symbol: async (symbol_id, updated_symbol_props) => {
		await dataChanged({
			table: 'symbols',
			action: 'update',
			id: symbol_id,
			data: updated_symbol_props
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
