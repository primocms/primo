import type { Entry } from '$lib/common/models/Entry.js'
import type { locales } from './common'
import { SiteFields, Sites, Pages, PageTypeFields, PageTypes, SiteSymbols, LibraryUploads } from './pocketbase/collections'
import type { Field } from './common/models/Field'
import { get_empty_value, convert_markdown_to_html, convert_rich_text_to_html, normalize_entry_value } from '$lib/builder/utils'
import { self } from './pocketbase/managers'
import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'
import { build_live_page_url } from './pages'
import { page_context, page_type_context, site_context } from './builder/stores/context'
import { is_entity_of, type Entity, type ENTITY_COLLECTIONS, type EntityOf } from './Entity'

export type UseContentOptions = {
	/**
	 * Whether the content should be tailored for a published site or editing.
	 * This can effect how links are generated.
	 */
	target: 'cms' | 'live'

	/**
	 * Page that will be used when referencing current page. This will be used
	 * when resolving page fields for example.
	 */
	page?: ObjectOf<typeof Pages>
}

export const useContent = <Collection extends keyof typeof ENTITY_COLLECTIONS>(entity: EntityOf<Collection>, options: UseContentOptions) => {
	const [fields, entries, uploads] = (() => {
		switch (true) {
			case is_entity_of(entity, 'library_symbols'): {
				return [entity.fields(), entity.entries(), LibraryUploads.list()] as const
			}

			case is_entity_of(entity, 'sites'): {
				return [entity.fields(), entity.entries(), entity.uploads()] as const
			}

			case is_entity_of(entity, 'site_symbols'): {
				const site = Sites.one(entity.site)
				return [entity.fields(), entity.entries(), site?.uploads()] as const
			}

			case is_entity_of(entity, 'page_types'): {
				const site = Sites.one(entity.site)
				return [entity.fields(), entity.entries(), site?.uploads()] as const
			}

			case is_entity_of(entity, 'pages'): {
				const page_type = PageTypes.one(entity.page_type)
				const site = Sites.one(entity.site)
				return [page_type?.fields(), entity.entries(), site?.uploads()] as const
			}

			case is_entity_of(entity, 'page_type_sections'): {
				const symbol = SiteSymbols.one(entity.symbol)
				const site = symbol && Sites.one(symbol.site)
				return [symbol?.fields(), entity.entries(), site?.uploads()] as const
			}

			case is_entity_of(entity, 'page_sections'): {
				const symbol = SiteSymbols.one(entity.symbol)
				const site = symbol && Sites.one(symbol.site)
				return [symbol?.fields(), entity.entries(), site?.uploads()] as const
			}

			default: {
				throw new Error('Unknown entity')
			}
		}
	})()

	const getContent = ({
		entity,
		fields,
		entries,
		parentField,
		parentEntry
	}: {
		entity?: Entity | null
		fields?: Field[] | null
		entries?: Entry[] | null
		parentField?: Field | null
		parentEntry?: Entry | null
	}) => {
		if (!entity || !fields || !entries || !uploads) {
			return
		}

		const content: { [K in (typeof locales)[number]]?: Record<string, unknown> } = {}
		const filteredFields = fields
			.filter((field) => {
				if ('symbol' in entity) {
					// section
					return 'symbol' in field && field.symbol === entity.symbol
				} else if ('slug' in entity) {
					// page
					return 'page_type' in field && field.page_type === entity.page_type
				} else if ('symbol' in field) {
					// symbol
					return field.symbol === entity.id
				} else if ('site' in field) {
					// site
					return field.site === entity.id
				} else if ('page_type' in field) {
					// page_type
					return field.page_type === entity.id
				} else {
					return false
				}
			})
			.filter((field) => (parentField ? field.parent === parentField.id : !field.parent))
			// Deduplicate
			.filter((field1, index, array) => array.findIndex((field2) => field2.id === field1.id) === index)
			// Remove fields without a key
			.filter((field) => !!field.key)

		for (const field of filteredFields) {
			const fieldEntries = resolveEntries({ entity, field, entries, parentEntry })
			if (!fieldEntries || !field.key) return

			// Handle page-field fields specially - get content from the page entity
			// Fallback behavior: If the referenced page field doesn't exist on the
			// current page type (or the value hasn't loaded yet), we degrade
			// gracefully by assigning a type-appropriate empty value via
			// get_empty_value(pageField). This prevents render errors and matches
			// the editor behavior where irrelevant Page Fields are hidden from
			// content editors. The fallback is applied consistently in all
			// assignment branches below using `?? get_empty_value(pageField)`.
			if (field.type === 'page-field') {
				const locale = 'en'
				if (!content[locale]) content[locale] = {}

				if (!field.config?.field) continue
				const pageField = PageTypeFields.one(field.config.field)
				if (pageField === null) continue
				if (!pageField) return
				if (!pageField.key) continue

				let data: ReturnType<typeof getContent> | null = null

				const { value: page } = page_context.getOr({ value: null })
				const { value: pageType } = page_type_context.getOr({ value: null })

				if (options.page) {
					// Override current page from options
					const page = options.page

					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) continue
					if (!pageType) return

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) return

					const pageEntries = page?.entries()
					if (pageEntries === null) continue
					if (!pageEntries) return

					data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) return

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				}
				// No override, use the page or page_type context if available
				else if (page) {
					// Use the current page
					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) continue
					if (!pageType) return

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) return

					const pageEntries = page?.entries()
					if (pageEntries === null) continue
					if (!pageEntries) return

					data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) return

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				} else if (pageType) {
					// Use the current page type
					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) return

					const pageTypeEntries = pageType?.entries()
					if (pageTypeEntries === null) continue
					if (!pageTypeEntries) return

					data = getContent({ entity: pageType, fields: pageTypeFields, entries: pageTypeEntries })
					if (!data) return

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				}
				// No page or page_type contexts, use parent entity
				else if ('page' in entity) {
					// This is a page section, use the parent page
					const page = Pages.one(entity.page)
					if (page === null) continue
					if (!page) return

					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) continue
					if (!pageType) return

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) return

					const pageEntries = page?.entries()
					if (pageEntries === null) continue
					if (!pageEntries) return

					data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) return

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				} else if ('page_type' in entity) {
					// This is page type section, use the parent page type
					const pageType = PageTypes.one(entity.page_type)
					if (pageType === null) continue
					if (!pageType) return

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) return

					const pageTypeEntries = pageType?.entries()
					if (pageTypeEntries === null) continue
					if (!pageTypeEntries) return

					data = getContent({ entity: pageType, fields: pageTypeFields, entries: pageTypeEntries })
					if (!data) return

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				}
			}

			// Handle site fields specially - get content from the site entity
			else if (field.type === 'site-field') {
				const locale = 'en'
				if (!content[locale]) content[locale] = {}

				if (!field.config?.field) continue
				const siteField = SiteFields.one(field.config.field)
				if (siteField === null) continue
				if (!siteField) return
				if (!siteField.key) continue

				const site = Sites.one(siteField.site)
				if (site === null) continue
				if (!site) return

				const siteFields = site.fields()
				if (siteFields === null) continue
				if (!siteFields) return

				const siteEntries = site.entries()
				if (siteEntries === null) continue
				if (!siteEntries) return

				const data = getContent({ entity: site, fields: siteFields, entries: siteEntries })
				if (!data) return

				content[locale]![field.key] = data[locale]?.[siteField.key]
			}

			// Handle group fields specially - collect subfield entries into an object
			else if (field.type === 'group') {
				const locale = 'en'
				if (!content[locale]) content[locale] = {}

				const [entry] = fieldEntries
				if (!entry) {
					content[locale]![field.key] = get_empty_value(field) ?? {}
					continue
				}

				const data = getContent({ entity, fields, entries, parentField: field, parentEntry: entry })
				if (!data) {
					content[locale]![field.key] = get_empty_value(field) ?? {}
					continue
				}

				content[locale]![field.key] = data[locale]
			}

			// Handle repeater fields specially - collect array of subfield entries into an object
			else if (field.type === 'repeater') {
				// Ensure we always provide an array, even if there are no entries
				if (fieldEntries.length === 0) {
					if (!content.en) content.en = {}
					content.en![field.key] = []
				}
				for (const entry of fieldEntries) {
					if (!content[entry.locale]) content[entry.locale] = {}
					if (!content[entry.locale]![field.key]) content[entry.locale]![field.key] = []

					const data = getContent({ entity, fields, entries, parentField: field, parentEntry: entry })
					if (!data) continue
					;(content[entry.locale]![field.key] as unknown[]).push(data[entry.locale])
				}
			}

			// Handle markdown fields: markdown -> HTML
			else if (field.type === 'markdown') {
				const [entry] = fieldEntries
				if (!entry) {
					if (!content.en) content.en = {}
					content.en![field.key] = get_empty_value(field)
					continue
				}
				const normalized_value = normalize_entry_value(entry.value)
				if (typeof normalized_value !== 'string') continue
				if (!content[entry.locale]) content[entry.locale] = {}

				content[entry.locale]![field.key] = convert_markdown_to_html(normalized_value)
			}

			// Handle rich-text fields: JSON -> HTML
			else if (field.type === 'rich-text') {
				const [entry] = fieldEntries
				if (!entry) {
					if (!content.en) content.en = {}
					content.en![field.key] = get_empty_value(field)
					continue
				}
				if (!content[entry.locale]) content[entry.locale] = {}
				const html = convert_rich_text_to_html(entry.value)
				content[entry.locale]![field.key] = html
			}

			// Handle image fields specially - get url
			else if (field.type === 'image') {
				const [entry] = fieldEntries
				if (!entry) {
					if (!content.en) content.en = {}
					content.en![field.key] = get_empty_value(field)
					continue
				}
				if (!content[entry.locale]) content[entry.locale] = {}

				const normalized_value = normalize_entry_value(entry.value) as Record<string, unknown> | null
				if (!normalized_value) {
					content[entry.locale]![field.key] = get_empty_value(field)
					continue
				}
				const upload_id: string | null | undefined = normalized_value.upload as string | null | undefined
				const upload = upload_id ? uploads.find((upload) => upload.id === upload_id) : null

				const is_library_symbol = 'group' in entity && 'html' in entity
				const upload_url =
					upload &&
					(options.target === 'live'
						? `/_uploads/${upload.file}`
						: typeof upload.file === 'string'
							? `${self.instance?.baseURL}/api/files/${is_library_symbol ? 'library_uploads' : 'site_uploads'}/${upload.id}/${upload.file}`
							: URL.createObjectURL(upload.file))
				const input_url: string | undefined = normalized_value.url as string | undefined
				const url = input_url || upload_url
				const alt: string = (normalized_value.alt as string) ?? ''
				const width: number | null | undefined = normalized_value.width as number | null | undefined
				const height: number | null | undefined = normalized_value.height as number | null | undefined
				content[entry.locale]![field.key] = { alt, url, width, height }
				content[entry.locale]![field.key] = { alt, url }
			}

			// Handle page fields specially - get content from the page entity
			else if (field.type === 'page') {
				const [entry] = fieldEntries
				if (!entry) {
					if (!content.en) content.en = {}
					content.en![field.key] = get_empty_value(field)
					continue
				}
				if (!content[entry.locale]) content[entry.locale] = {}

				const normalized_page_value = normalize_entry_value(entry.value)
				const page = Pages.one(normalized_page_value as string)
				if (page === null) continue
				if (!page) return

				const pageType = PageTypes.one(page.page_type)
				if (pageType === null) continue
				if (!pageType) return

				const pageTypeFields = pageType.fields()
				if (pageTypeFields === null) continue
				if (!pageTypeFields) return

				const pageEntries = page.entries()
				if (pageEntries === null) continue
				if (!pageEntries) return

				const data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
				if (!data) return

				const url = build_live_page_url(page)?.pathname
				if (url === undefined) continue

				content[entry.locale]![field.key] = {
					...data[entry.locale],
					_meta: {
						created_at: page.created, // TODO: Fix typing
						name: page.name,
						slug: page.slug,
						url
					}
				}
			}

			// Handle page-list fields specially
			else if (field.type === 'page-list') {
				if (!field.config?.page_type) continue
				const pages = Pages.list({ filter: { page_type: field.config.page_type } })?.sort((a, b) => a.index - b.index)
				if (pages === null) continue
				if (!pages) return

				const data = pages.map((page) => {
					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) return null
					if (!pageType) return

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) return null
					if (!pageTypeFields) return

					const pageEntries = page.entries()
					if (pageEntries === null) return null
					if (!pageEntries) return

					const data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) return

					return data
				})
				if (data.some((content) => content === null)) continue
				if (data.some((content) => !content)) return

				for (let index = 0; index < pages.length; index++) {
					for (const locale in { en: {}, ...data[index] }) {
						if (!content[locale]) content[locale] = {}
						if (!content[locale][field.key]) content[locale][field.key] = []

						const url = build_live_page_url(pages[index])?.pathname
						if (url === undefined) return

						content[locale][field.key].push({
							...data[index]?.[locale],
							_meta: {
								created_at: pages[index].created, // TODO: Fix typing
								name: pages[index].name,
								slug: pages[index].slug,
								url
							}
						})
					}
				}
			}

			// Handle link fields specifially - translate page ID into URL
			else if (field.type === 'link') {
				const [entry] = fieldEntries
				if (!entry) {
					if (!content.en) content.en = {}
					content.en![field.key] = get_empty_value(field)
					continue
				}
				if (!content[entry.locale]) content[entry.locale] = {}

				// If a page is referenced, try to resolve it; otherwise fall back to the raw URL
				const page = entry.value.page ? Pages.one(entry.value.page) : null
				// If the referenced page hasn't loaded yet, skip this field for now instead of aborting
				if (page === undefined) continue

				const url = page ? build_live_page_url(page)?.pathname : entry.value.url
				// If we still don't have a URL (e.g. unresolved page and no URL), set empty string rather than aborting
				const safe_url = url ?? ''

				const label = entry.value.label ?? ''
				content[entry.locale]![field.key] = { url: safe_url, label, text: label }
			}

			// If field has a key but no entries, fill with empty value
			else if (field.key && fieldEntries.length === 0) {
				if (!content.en) content.en = {}
				content.en![field.key] = get_empty_value(field)
			}

			// For single-value fields, collect just get the first value
			else if (field.key) {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}
				content[entry.locale]![field.key] = entry.value
			}
		}

		return content
	}

	return getContent({ entity, fields, entries })
}

export const useEntries = (entity: Entity, field: Field, parentEntry?: Entry) => {
	const entries = (() => {
		switch (true) {
			case is_entity_of(entity, 'library_symbols'):
				return entity.entries()

			case is_entity_of(entity, 'sites'):
				return entity.entries()

			case is_entity_of(entity, 'site_symbols'):
				return entity.entries()

			case is_entity_of(entity, 'page_types'):
				return entity.entries()

			case is_entity_of(entity, 'pages'):
				return entity.entries()

			case is_entity_of(entity, 'page_type_sections'):
				return entity.entries()

			case is_entity_of(entity, 'page_sections'):
				return entity.entries()

			default:
				throw new Error('Unknown entity')
		}
	})()

	return entries && resolveEntries({ entity, field, entries, parentEntry })
}

const resolveEntries = ({ entity, field, entries, parentEntry }: { entity: Entity; field: Field; entries: Entry[]; parentEntry?: Entry | null }): Entry[] | undefined => {
	const fieldEntries = entries
		.filter((entry) => entry.field === field.id && (!('section' in entry) || entry.section === entity.id))
		.filter((entry) => (parentEntry ? entry.parent === parentEntry.id : !entry.parent))
		.sort((a, b) => a.index - b.index)

	// Handle page-field fields specially - get entries from the page entity
	if (field.type === 'page-field' && field.key) {
		if (!field.config?.field) return []
		const sourceField = PageTypeFields.one(field.config.field)
		if (sourceField === null) return []
		if (!sourceField) return

		let sourceEntity: ObjectOf<typeof Pages> | ObjectOf<typeof PageTypes> | undefined | null = null

		// Try to use the page or page_type context first
		const { value: page } = page_context.getOr({ value: null })
		const { value: pageType } = page_type_context.getOr({ value: null })
		if (page) {
			// Page context found
			sourceEntity = page
		} else if (pageType) {
			// Page type context found
			sourceEntity = pageType
		}
		// No page or page_type contexts, use parent entity
		else if ('page' in entity) {
			// This is a page section, use the parent page
			sourceEntity = Pages.one(entity.page)
		} else if ('page_type' in entity) {
			// This is page type section, use the parent page type
			sourceEntity = PageTypes.one(entity.page_type)
		}

		if (sourceEntity === null) return []
		if (!sourceEntity) return

		const sourceEntries = 'page_type' in sourceEntity ? sourceEntity.entries() : sourceEntity.entries()
		if (sourceEntries === null) return []
		if (!sourceEntries) return

		return resolveEntries({ entity: sourceEntity, field: sourceField, entries: sourceEntries })
	}

	// Handle site fields specially - get entries from the site entity
	else if (field.type === 'site-field' && field.key) {
		if (!field.config?.field) return []
		const siteField = SiteFields.one(field.config.field)
		if (siteField === null) return []
		if (!siteField) return

		const site = Sites.one(siteField.site)
		if (site === null) return []
		if (!site) return

		const siteEntries = site.entries()
		if (siteEntries === null) return []
		if (!siteEntries) return

		return resolveEntries({ entity: site, field: siteField, entries: siteEntries })
	}

	// Otherwise, return direct entries
	else {
		return fieldEntries
	}
}
