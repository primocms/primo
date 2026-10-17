import type Client from 'pocketbase'
import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'
import { Pages, PageTypes, Sites, SiteSymbols } from './pocketbase/collections'
import { self } from './pocketbase/managers'
import type { CollectionManager } from './pocketbase/CollectionManager'

export const usePageData = (site?: ObjectOf<typeof Sites>, pages?: ObjectOf<typeof Pages>[], manager: CollectionManager = self) => {
	const page_types = $derived(
		pages?.every((page) => PageTypes.from(manager).one(page.page_type) !== undefined) ? pages.flatMap((page) => PageTypes.from(manager).one(page.page_type) ?? []).filter(deduplicate('id')) : undefined
	)
	const page_sections = $derived(pages?.every((page) => page.sections() !== undefined) ? pages.flatMap((page) => page.sections() ?? []).filter(deduplicate('id')) : undefined)
	const page_type_sections = $derived(
		page_types?.every((page_type) => page_type.sections() !== undefined) ? page_types.flatMap((page_type) => page_type.sections() ?? []).filter(deduplicate('id')) : undefined
	)
	const page_type_symbols = $derived(
		page_types?.every((page_type) => page_type.symbols() !== undefined) ? page_types.flatMap((page_type) => page_type.symbols() ?? []).filter(deduplicate('id')) : undefined
	)
	const sections = $derived(page_sections && page_type_sections && [...page_sections, ...page_type_sections])
	const symbols = $derived(
		sections?.map((section) => SiteSymbols.from(manager).one(section.symbol)).every((symbol) => symbol !== undefined)
			? sections
					.map((section) => SiteSymbols.from(manager).one(section.symbol))
					.filter((symbol) => symbol !== undefined)
					.filter((symbol) => symbol !== null)
					.filter(deduplicate('id'))
			: undefined
	)
	const site_uploads = $derived(site?.uploads())
	const site_fields = $derived(site?.fields())
	const page_type_fields = $derived(
		page_types?.every((page_type) => page_type.fields() !== undefined) ? page_types.flatMap((page_type) => page_type.fields() ?? []).filter(deduplicate('id')) : undefined
	)
	const symbol_fields = $derived(symbols?.every((symbol) => symbol.fields() !== undefined) ? symbols.flatMap((symbol) => symbol.fields() ?? []).filter(deduplicate('id')) : undefined)
	const site_entries = $derived(site?.entries())
	const page_type_entries = $derived(
		page_types?.every((page_type) => page_type.entries() !== undefined) ? page_types.flatMap((page_type) => page_type.entries() ?? []).filter(deduplicate('id')) : undefined
	)
	const symbol_entries = $derived(symbols?.every((symbol) => symbol.entries() !== undefined) ? symbols.flatMap((symbol) => symbol.entries() ?? []).filter(deduplicate('id')) : undefined)
	const page_entries = $derived(pages?.every((page) => page.entries() !== undefined) ? pages.flatMap((page) => page.entries() ?? []).filter(deduplicate('id')) : undefined)
	const page_section_entries = $derived(
		page_sections?.every((section) => section.entries() !== undefined) ? page_sections.flatMap((section) => section.entries() ?? []).filter(deduplicate('id')) : undefined
	)
	const page_type_section_entries = $derived(
		page_type_sections?.every((section) => section.entries() !== undefined) ? page_type_sections.flatMap((section) => section.entries() ?? []).filter(deduplicate('id')) : undefined
	)

	const data = $derived(
		site &&
			pages &&
			page_types &&
			page_sections &&
			page_type_sections &&
			page_type_symbols &&
			symbols &&
			site_uploads &&
			site_fields &&
			page_type_fields &&
			symbol_fields &&
			site_entries &&
			page_type_entries &&
			symbol_entries &&
			page_entries &&
			page_section_entries &&
			page_type_section_entries && {
				site,
				pages,
				page_types,
				page_sections,
				page_type_sections,
				page_type_symbols,
				symbols,
				site_uploads,
				site_fields,
				page_type_fields,
				symbol_fields,
				site_entries,
				page_type_entries,
				page_entries,
				symbol_entries,
				page_section_entries,
				page_type_section_entries
			}
	)
	return {
		get data() {
			return data
		}
	}
}

const deduplicate =
	<T>(key: keyof T) =>
	(item: T, index: number, array: T[]) =>
		array.findIndex((value) => value[key] === item[key]) === index
