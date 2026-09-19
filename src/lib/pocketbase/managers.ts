import { createCollectionManager } from './CollectionManager'
import { self as this_instance, marketplace as marketplace_instance } from './instances'
import { track_content_saved } from '../analytics'

// Collections that hold actual content field values (as opposed to
// structural records like sites/pages/page_types/role assignments, which are
// covered by their own dedicated events).
const CONTENT_ENTRY_COLLECTIONS = new Set(['site_entries', 'page_type_section_entries', 'page_section_entries'])

export const self = createCollectionManager(this_instance, ({ collection, operation }) => {
	if ((operation === 'update' || operation === 'create') && CONTENT_ENTRY_COLLECTIONS.has(collection)) {
		track_content_saved()
	}
})
export const activity = createCollectionManager(this_instance)
export const marketplace = createCollectionManager(marketplace_instance)
