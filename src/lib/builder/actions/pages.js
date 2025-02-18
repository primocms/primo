import _, { cloneDeep } from 'lodash-es'
import { get } from 'svelte/store'
import { goto } from '$app/navigation'
import {Page, Content_Row, Section} from '$lib/builder/factories'
import active_page_store from '$lib/builder/stores/data/page'
import stores, { update_timeline } from '$lib/builder/stores/data'
import { site } from '$lib/builder/stores/data/site'
import { dataChanged } from '$lib/builder/database'
import { get_ancestors } from './_helpers'
import {update_sitemap} from './_storage_helpers'
import * as db_utils from './_db_utils'
import {remap_entry_ids, remap_ids, sort_by_hierarchy} from './_db_utils'

export const update_page_entries = {
	store: async function (entries) {
		active_page_store.update(store => ({
			...store,
			entries
		}))

		// refresh sections on page to fetch updated page entries from source
		stores.sections.update((store) => store)
	},
	db: async function (original_entries, updated_entries) {
		const changes = db_utils.generate_entry_changes(original_entries, updated_entries)
		// TODO: use handle_content_changes to handle repeater item creation?
		for (const { action, id, data } of changes) {
			await dataChanged({
				table: 'entries',
				action,
				id,
				data: { ...data, page: get(active_page_store).id }
			})
		}
		// await update_timeline({
		// 	doing: async () => {
		// 	},
		// 	undoing: async () => {
		// 		// TODO: do the inverse
		// 	}
		// })
	}
}

export default {
	/** @param {import('$lib').Page} page_args */
	create: async (page_args) => {

		let new_page_id 
		const original_pages = get(stores.pages)

		await update_timeline({
			doing: async () => {
				const new_page = Page(page_args)
				new_page_id = new_page.id

				// STORE: create new page
				stores.pages.update((store) => [...store, new_page])

				// Get page type entries & sections to add to page
				const [ page_type_entries, page_type_sections ] = await Promise.all([
					dataChanged({
						table: 'entries',
						action: 'select',
						data: '*',
						match: { page_type: new_page.page_type }
					}),
					dataChanged({
						table: 'sections',
						action: 'select',
						data: '*, entries(*)',
						match: { page_type: new_page.page_type }
					})
				])

				const new_page_entries = remap_entry_ids(page_type_entries).map(e => ({ ...e, page_type: null, page: new_page.id }))
				const new_page_sections = page_type_sections.map(s => {
					const new_section = Section({ page_type: null, page: new_page.id, master: s.id, index: s.index })
					new_section.entries = remap_entry_ids(s.entries).map(e => ({ ...e, section: new_section.id }))
					return new_section
				})

				// DB: save page, mastered sections, and entries
				await dataChanged({
					table: 'pages',
					action: 'insert',
					data: _.omit(new_page, ['entries'])
				})
				await dataChanged({
					table: 'sections',
					action: 'insert',
					data: new_page_sections?.map(s => _.omit(s, ['entries']))
				})
				await dataChanged({
					table: 'entries',
					action: 'insert',
					data: [ ...sort_by_hierarchy(new_page_entries), ...sort_by_hierarchy(new_page_sections.flatMap(s => s.entries)) ]
				})

				update_sitemap()
			},
			undoing: async () => {
				stores.pages.set(original_pages)
				await dataChanged({ table: 'pages', action: 'delete', id: new_page_id })
				update_sitemap()
			}
		})
	},
	delete: async (page) => {
		let deleted_page_id = page.id
		let deleted_pages
		let deleted_sections

		await update_timeline({
			doing: async () => {
				const original_pages = cloneDeep(get(stores.pages))

				// keep deleted pages
				deleted_pages = original_pages.filter((p) => p.id === deleted_page_id || get_ancestors(p, original_pages).find(i => i.id === deleted_page_id))
				
				// STORE: delete page & children
				const updated_pages = original_pages.filter((p) => !deleted_pages.find(dp => dp.id === p.id))
				stores.pages.set(updated_pages)
		
				// keep deleted sections
				deleted_sections = await Promise.all(
					deleted_pages.map(page => dataChanged({
						table: 'sections',
						action: 'select',
						data: '*, entries(*)',
						match: { page: page.id }
					}))
				).then(arr => arr.flat())
		
				// DB: delete pages
				await dataChanged({ table: 'pages', action: 'delete', id: deleted_page_id }) // will cascade-delete children, section, and entries

				// Go to home page if active page is deleted
				if (deleted_pages.some(p => p.id === get(active_page_store).id)) {
					await goto(`/${get(site)['id']}`)
				}
				update_sitemap()
			},
			undoing: async () => {
				const recreated = remap_ids({ pages: deleted_pages, sections: deleted_sections })
				deleted_page_id = recreated._map.get(deleted_page_id)
				const recreated_pages = recreated.pages.map(s => _.omit(s, ['entries']))
				const recreated_sections = recreated.sections.map(s => _.omit(s, ['entries']))
				const recreated_entries = [
					...recreated.pages.flatMap(p => p.entries),
					...recreated.sections.flatMap(s => s.entries)
				]

				// STORE: restore page and children
				stores.pages.update(store => [...store, ...recreated.pages])

				// DB: insert deleted page and children
				await dataChanged({ table: 'pages', action: 'insert', data: sort_by_hierarchy(recreated_pages) })
				await dataChanged({ table: 'sections', action: 'insert', data: sort_by_hierarchy(recreated_sections, 'palette') })
				await dataChanged({ table: 'entries', action: 'insert', data: sort_by_hierarchy(recreated_entries) })

				update_sitemap()
			}
		})
	},
	update: async (page_id, obj) => {
		const original_page = cloneDeep(get(stores.pages).find((page) => page.id === page_id))
		const current_pages = cloneDeep(get(stores.pages))
		const updated_pages = current_pages.map((page) => (page.id === page_id ? { ...page, ...obj } : page))
		stores.pages.set(updated_pages)

		stores.pages.set(updated_pages)
		await dataChanged({ table: 'pages', action: 'update', id: page_id, data: obj })

		// await update_timeline({
		// 	doing: async () => {
		// 	},
		// 	undoing: async () => {
		// 		stores.pages.set(current_pages)
		// 		await dataChanged({ table: 'pages', action: 'update', id: page_id, data: original_page })
		// 	}
		// })
	},
	rearrange: async (page, new_position) => {
		const original_pages = _.cloneDeep(get(stores.pages))

		const updated_pages = _.cloneDeep(get(stores.pages))

		// select siblings (could be root level)
		const siblings = original_pages.filter((p) => p.parent === page.parent && p.id !== page.id).sort((a, b) => a.index - b.index)

		// update siblings & self w/ new indeces
		const updated_children = [...siblings.slice(0, new_position), page, ...siblings.slice(new_position)].map((p, i) => ({ ...p, index: i }))

		// set updated pages w/ updated indeces
		for (const child of updated_children) {
			updated_pages.find((p) => p.id === child.id)['index'] = child.index
		}

		stores.pages.set(updated_pages)

		// update sibling page indeces
		await Promise.all(
			updated_children.map((page) =>
				dataChanged({
					table: 'pages',
					action: 'update',
					id: page.id,
					data: { index: page.index }
				})
			)
		)

		// await update_timeline({
		// 	doing: async () => {
		// 	},
		// 	undoing: async () => {
		// 		stores.pages.set(current_pages)
		// 		await dataChanged({ table: 'pages', action: 'update', id: page_id, data: original_page })
		// 	}
		// })
	}
}
