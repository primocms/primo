/**
 * Collect the upload ids a site's content actually references, so the snapshot
 * builder can pack only those files instead of every upload record for the site
 * (which includes orphaned and duplicate uploads). See Snapshot.svelte.ts.
 *
 * Image-field entries store the reference as `value.upload = <upload_id>`.
 * Repeater and group children are flat entries with their own value, so a plain
 * walk over every entry value catches nested images too.
 *
 * Note: rich-text / markdown / symbol-CSS images embedded as a raw file URL
 * (rather than an id) are not traced here. A snapshot missing such a file only
 * degrades a restored copy of the site, never the published site itself, so the
 * simpler id-only trace is the intentional trade-off.
 */

const collect = (value: unknown, ids: Set<string>) => {
	if (value == null || typeof value !== 'object') return
	if (Array.isArray(value)) {
		for (const item of value) collect(item, ids)
		return
	}
	const record = value as Record<string, unknown>
	if (typeof record.upload === 'string' && record.upload) ids.add(record.upload)
	for (const key in record) collect(record[key], ids)
}

/**
 * `data` is the assembled site data (PageData.svelte.ts). Returns the set of
 * upload ids referenced by any entry across the site's content.
 */
export const collect_referenced_upload_ids = (data: {
	site_entries?: Array<{ value?: unknown }> | null
	page_entries?: Array<{ value?: unknown }> | null
	page_section_entries?: Array<{ value?: unknown }> | null
	page_type_entries?: Array<{ value?: unknown }> | null
	page_type_section_entries?: Array<{ value?: unknown }> | null
	symbol_entries?: Array<{ value?: unknown }> | null
}): Set<string> => {
	const ids = new Set<string>()
	for (const entries of [
		data.site_entries,
		data.page_entries,
		data.page_section_entries,
		data.page_type_entries,
		data.page_type_section_entries,
		data.symbol_entries
	]) {
		for (const entry of entries ?? []) collect(entry.value, ids)
	}
	return ids
}
