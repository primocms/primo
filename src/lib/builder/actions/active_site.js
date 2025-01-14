import { dataChanged } from '$lib/builder/database'
import { site, update as update_site } from '$lib/builder/stores/data/site'
import { get } from 'svelte/store'
import { page } from '$app/stores'
import stores, { update_timeline } from '$lib/builder/stores/data'
import { handle_content_changes, handle_field_changes } from './_helpers'
import {update_page_file} from '$lib/builder/actions/_storage_helpers'

export async function update_site_code_and_content({ code, entries, fields, content_changes, fields_changes }) {

	// ensure each entry has site property to prevent bugs in SectionEditor when working w/ site entries
	const updated_entries = entries.map(e => ({ ...e, site: get(site).id }))

	update_site({ code, entries: updated_entries, fields })

	const field_db_ids = await handle_field_changes(fields_changes, { site: get(site).id })
	const content_db_ids = await handle_content_changes(content_changes, field_db_ids, {
		site: get(site).id
	})

	// STORE: update local felds w/ field_db_ids & local entries w/ content_db_ids
	update_site({
		fields: get(site).fields.map((f) => ({
			...f,
			id: field_db_ids[f.id] || f.id,
			parent: field_db_ids[f.parent] || f.parent
		})),
		entries: get(site).entries.map((e) => ({
			...e,
			id: content_db_ids[e.id] || e.id,
			parent: content_db_ids[e.parent] || e.parent,
			field: field_db_ids[e.field] || e.field
		}))
	})

	await dataChanged({
		table: 'sites',
		action: 'update',
		id: get(site).id,
		data: { code }
	})

	// STORE: update sections to trigger on-page update for any data fields in use
	stores.sections.update((s) => s)

	if (content_changes.length > 0) {
		update_page_file(true)
	}

	// TODO: handle undo
	// await update_timeline({
	// 	doing: async () => {
	// 	},
	// 	undoing: async () => {
	// 	}
	// })
}

export default {
	update: async (props) => {
		update_site(props)
		await dataChanged({
			table: 'sites',
			action: 'update',
			data: props,
			id: get(page).data.site.id
		})
	}
}
