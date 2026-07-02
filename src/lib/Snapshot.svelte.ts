import type { CollectionManager } from '$lib/pocketbase/CollectionManager'
import {
	Sites,
	SiteUploads,
	SiteFields,
	SiteEntries,
	SiteSymbols,
	SiteSymbolFields,
	SiteSymbolEntries,
	PageTypes,
	PageTypeFields,
	PageTypeEntries,
	PageTypeSymbols,
	PageTypeSections,
	PageTypeSectionEntries,
	Pages,
	PageEntries,
	PageSections,
	PageSectionEntries
} from '$lib/pocketbase/collections'
import { self } from '$lib/pocketbase/managers'
import type { Snapshot } from './common/models/Snapshot'
import { collect_referenced_upload_ids } from './common/upload-references'
import { instance } from './instance'
import { usePageData } from './PageData.svelte'
import { useSvelteWorker } from './workers/Worker.svelte'

export const useSiteSnapshot = ({ source_manager = self, source_site_id }: { source_manager?: CollectionManager; source_site_id?: string }) => {
	const worker = useSvelteWorker(
		() => !!source_site_id,
		() => !!source_site && !!source_site_pages && !!source_site_data.data,
		async () => {
			const { data } = source_site_data
			if (!data || !source_site) {
				throw new Error('Not loaded')
			}

			const download = async (collection: string, id: string, filename: string) =>
				fetch(`${source_manager.instance?.baseURL}/api/files/${collection}/${id}/${filename}`)
					.then((res) => res.blob())
					.then((blob) => new File([blob], filename))

			// Only pack uploads the content actually references. Orphaned and
			// duplicate upload records (e.g. from repeated image edits) would
			// otherwise bloat snapshot.bin past the site_snapshots file limit.
			const referenced_upload_ids = collect_referenced_upload_ids(data)

			const snapshot: Snapshot = {
				metadata: {
					created_at: new Date().toISOString(),
					source_instance_id: instance.id,
					source_instance_version: instance.version
				},
				records: {
					sites: [source_site.values()],
					site_uploads: await Promise.all(
						data.site_uploads
							.filter((upload) => referenced_upload_ids.has(upload.id))
							.map(async (upload) => ({
								...upload.values(),
								file: typeof upload.file === 'string' ? await download('site_uploads', upload.id, upload.file) : upload.file
							}))
					),
					site_fields: data.site_fields.map((upload) => upload.values()),
					site_entries: data.site_entries.map((upload) => upload.values()),
					site_symbols: data.symbols.map((upload) => upload.values()),
					site_symbol_fields: data.symbol_fields.map((upload) => upload.values()),
					site_symbol_entries: data.symbol_entries.map((upload) => upload.values()),
					page_types: data.page_types.map((upload) => upload.values()),
					page_type_fields: data.page_type_fields.map((upload) => upload.values()),
					page_type_entries: data.page_type_entries.map((upload) => upload.values()),
					page_type_symbols: data.page_type_symbols.map((upload) => upload.values()),
					page_type_sections: data.page_type_sections.map((upload) => upload.values()),
					page_type_section_entries: data.page_type_section_entries.map((upload) => upload.values()),
					pages: data.pages.map((upload) => upload.values()),
					page_entries: data.page_entries.map((upload) => upload.values()),
					page_sections: data.page_sections.map((upload) => upload.values()),
					page_section_entries: data.page_section_entries.map((upload) => upload.values())
				}
			}

			return snapshot
		}
	)

	const shouldLoad = $derived(['loading', 'working'].includes(worker.status))
	const source_site = $derived(shouldLoad && source_site_id ? Sites.from(source_manager).one(source_site_id) : undefined)
	const source_site_pages = $derived(shouldLoad && source_site ? source_site.pages() : undefined)
	const source_site_data = $derived(shouldLoad && source_site && source_site_pages ? usePageData(source_site, source_site_pages, source_manager) : { data: undefined })

	return worker
}

export const import_snapshot = ({ destination_manager = self, source_snapshot }: { destination_manager?: CollectionManager; source_snapshot: Snapshot }) => {
	source_snapshot.records.sites.forEach((site) => Sites.from(destination_manager).create(site))
	source_snapshot.records.site_uploads.forEach((site_upload) => SiteUploads.from(destination_manager).create(site_upload))
	source_snapshot.records.site_fields.forEach((site_field) => SiteFields.from(destination_manager).create(site_field))
	source_snapshot.records.site_entries.forEach((site_entry) => SiteEntries.from(destination_manager).create(site_entry))
	source_snapshot.records.site_symbols.forEach((site_symbol) => SiteSymbols.from(destination_manager).create(site_symbol))
	source_snapshot.records.site_symbol_fields.forEach((site_symbol_field) => SiteSymbolFields.from(destination_manager).create(site_symbol_field))
	source_snapshot.records.site_symbol_entries.forEach((site_symbol_entry) => SiteSymbolEntries.from(destination_manager).create(site_symbol_entry))
	source_snapshot.records.page_types.forEach((page_type) => PageTypes.from(destination_manager).create(page_type))
	source_snapshot.records.page_type_fields.forEach((page_type_field) => PageTypeFields.from(destination_manager).create(page_type_field))
	source_snapshot.records.page_type_entries.forEach((page_type_entry) => PageTypeEntries.from(destination_manager).create(page_type_entry))
	source_snapshot.records.page_type_symbols.forEach((page_type_symbol) => PageTypeSymbols.from(destination_manager).create(page_type_symbol))
	source_snapshot.records.page_type_sections.forEach((page_type_section) => PageTypeSections.from(destination_manager).create(page_type_section))
	source_snapshot.records.page_type_section_entries.forEach((page_type_section_entry) => PageTypeSectionEntries.from(destination_manager).create(page_type_section_entry))
	source_snapshot.records.pages.forEach((page) => Pages.from(destination_manager).create(page))
	source_snapshot.records.page_entries.forEach((page_entry) => PageEntries.from(destination_manager).create(page_entry))
	source_snapshot.records.page_sections.forEach((page_section) => PageSections.from(destination_manager).create(page_section))
	source_snapshot.records.page_section_entries.forEach((page_section_entry) => PageSectionEntries.from(destination_manager).create(page_section_entry))
}
