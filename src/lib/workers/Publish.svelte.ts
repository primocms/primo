import type { Page } from '$lib/common/models/Page'
import type { PageSection } from '$lib/common/models/PageSection'
import type { PageTypeSection } from '$lib/common/models/PageTypeSection'
import type { SiteSymbol } from '$lib/common/models/SiteSymbol'
import { PRIMO_BASELINE_CSS } from '$lib/common/baseline-css'
import { useContent } from '$lib/Content.svelte'
import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
import { processors } from '../builder/component'
import { usePageData } from '../PageData.svelte'
import { Pages, PageSections, PageTypeSections, Sites } from '../pocketbase/collections'
import { self } from '../pocketbase/managers'
import { useSvelteWorker } from './Worker.svelte'

export const usePublishSite = (site_id?: string) => {
	const worker = useSvelteWorker(
		() => !!site_id,
		() => !!site && !!pages && !!page_types && !!data && !!site_content && !!page_content && !!section_content && !!symbols_with_field_keys,
		async () => {
			if (!data) {
				throw new Error('Not loaded')
			}

			const promises: Promise<void>[] = []
			for (const { symbol, field_keys } of symbols_with_field_keys!) {
				if (!symbol.js) {
					// No need to compile symbol JavaScript if there's none
					continue
				}

				const locale = 'en' as const
				const { css } = await processors.css(symbol.css || '')

				// Get symbol's default content
				const symbol_data = symbol_content?.[symbol.id]?.[locale] ?? {}

				// Use pre-computed field keys to create data object
				// This ensures the compiled JS knows which props to destructure
				const generic_data = Object.fromEntries(
					field_keys.map(key => [key, symbol_data[key] ?? ''])
				)

				const promise = processors
					.html({
						component: {
							html: symbol.html,
							js: symbol.js,
							css,
							data: generic_data
						},
						buildStatic: false,
						css: 'external',

						// TODO: Svelte runtime needs to be in common bundle shared by all symbol modules.
						runtime: ['hydrate']
					})
					.then(async (res) => {
						if (res.error) {
							console.error(`Symbol compilation error for "${symbol.name || symbol.id}":`, res.error)
							throw new Error(`Compiling symbol "${symbol.name || symbol.id}" failed: ${res.error}`)
						}
						if (!res.js) {
							console.error(`Symbol compilation failed for "${symbol.name || symbol.id}": No JavaScript output`)
							throw new Error(`Compiling symbol "${symbol.name || symbol.id}" not successful: No JavaScript output`)
						}

						await self.instance?.collection('site_symbols').update(symbol.id, {
							compiled_js: new File([res.js], 'symbol.js', { type: 'text/javascript' })
						})
					})
					.catch((error) => {
						console.error(`Failed to compile symbol "${symbol.name || symbol.id}":`, error)
						throw error // Re-throw to be caught by Promise.all
					})
				promises.push(promise)
			}

			for (const page of data.pages) {
				if (!page.parent) {
					// Generate site preview from homepage
					const promise = generate_page(page, true).then(async ({ success, html, error }) => {
						if (!success) {
							console.error(`Site preview generation failed for page "${page.name || page.id}":`, error || 'Unknown error')
							throw new Error(`Generating site preview not successful for page "${page.name || page.id}": ${error || 'Unknown error'}`)
						}
						if (!site) {
							throw new Error('No site')
						}

						await self.instance?.collection('sites').update(site.id, {
							preview: new File([html], 'index.html')
						})
					})
					promises.push(promise)
				}

				const promise = generate_page(page)
					.then(async ({ success, html, error, page_info }) => {
						if (!success) {
							console.error(`Page generation failed for "${page.name || page.id}":`, {
								page_id: page.id,
								page_name: page.name,
								page_slug: page.slug,
								error: error || 'Unknown error',
								...page_info
							})
							throw new Error(`Generating page "${page.name || page.id}" (${page.slug || '/'}) not successful: ${error || 'Unknown error'}`)
						}

						await self.instance?.collection('pages').update(page.id, {
							compiled_html: new File([html], 'index.html', { type: 'text/html' })
						})
					})
					.catch((error) => {
						console.error(`Page compilation error for "${page.name || page.id}":`, error)
						throw error // Re-throw to be caught by Promise.all
					})
				promises.push(promise)
			}

			await Promise.all(promises)
			await fetch(new URL('/api/primo/generate', self.instance?.baseURL), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${self.instance?.authStore.token}`
				},
				body: JSON.stringify({ site_id })
			}).then((res) => {
				if (!res.ok) {
					throw new Error('Failed to generate site: Not OK response')
				}
			})
		}
	)

	const generate_page = async (page: Page, no_js = false) => {
		const locale = 'en' as const
		let error_details = ''
		let page_info: Record<string, any> = {}

		try {
			const page_type = page_types?.find((page_type) => page_type.id === page.page_type)
			const page_sections = data?.page_sections.filter((section) => section.page === page.id)
			const page_type_sections = data?.page_type_sections.filter((section) => section.page_type === page_type?.id)

			const header_sections = page_type_sections?.filter((section) => section.zone === 'header')
			const footer_sections = page_type_sections?.filter((section) => section.zone === 'footer')
			const body_sections = page_sections

			const sections = [...(header_sections ?? []), ...(body_sections ?? []), ...(footer_sections ?? [])].filter(deduplicate('id'))

			page_info = {
				page_type: page_type?.name || page.page_type,
				sections_count: sections.length,
				section_ids: sections.map((s) => s.id)
			}

			console.log(`Generating page "${page.name || page.id}" with ${sections.length} sections`)

			// Helper to build components for a section group
			const build_components = async (section_group: (PageTypeSection | PageSection)[]) => {
				return (
					await Promise.all(
						section_group.map(async (section: PageTypeSection | PageSection, index: number) => {
							try {
								const symbol = data?.symbols.find((symbol) => symbol.id === section.symbol)
								if (!symbol) {
									console.warn(`Section ${index} (${section.id}) references missing symbol: ${section.symbol}`)
									return []
								}

								const { html, css: postcss, js } = symbol

								const { css } = await processors.css(postcss || '')
								return [
									{
										html,
										js,
										css,
										data: section_content?.[page.id]?.[section.id]?.[locale] ?? {},
										wrapper_start: `<div data-section="${section.id}" id="section-${section.id}" data-symbol="${symbol.id}">`,
										wrapper_end: '</div>'
									}
								]
							} catch (section_error) {
								console.error(`Error processing section ${index} (${section.id}):`, section_error)
								throw new Error(`Failed to process section ${index} (${section.id}): ${section_error}`)
							}
						})
					)
				).flat()
			}

			const site_data = {
				...site_content?.[locale],
				...page_content?.[page.id]?.[locale]
			}

			const head = {
				code: `<style data-primo-baseline>${PRIMO_BASELINE_CSS}</style>` + (site?.head ?? '') + (page_type?.head ?? ''),
				data: site_data
			}

			// Process each zone separately and collect CSS from each
			// Pass head to all zones (needed for head.data), but only include head.code once
			const head_without_code = { code: '', data: head.data }

			console.log(`Compiling HTML for page "${page.name || page.id}"`)

			const has_header = header_sections && header_sections.length > 0
			const has_body = body_sections && body_sections.length > 0

			const header_result = has_header
				? await processors.html({
					component: await build_components(header_sections),
					head, // Include custom head code in first zone processing
					locale,
					css: 'external'
				})
				: { body: '', head: '' }

			const body_result = has_body
				? await processors.html({
					component: await build_components(body_sections),
					head: has_header ? head_without_code : head, // Include head.code if no header zone
					locale,
					css: 'external'
				})
				: { body: '', head: '' }

			const footer_result = footer_sections && footer_sections.length > 0
				? await processors.html({
					component: await build_components(footer_sections),
					head: (has_header || has_body) ? head_without_code : head, // Include head.code if no header/body zones
					locale,
					css: 'external'
				})
				: { body: '', head: '' }

			// Check for errors in any zone
			if (header_result.error || body_result.error || footer_result.error) {
				const zone_error = header_result.error || body_result.error || footer_result.error
				error_details = `HTML compilation error: ${zone_error}`
				console.error(`HTML compilation error for page "${page.name || page.id}":`, zone_error)
				return {
					success: false,
					html: '',
					js: '',
					error: error_details,
					page_info
				}
			}

			// Combine CSS from all zones (header includes custom head.code)
			const combined_head = (header_result.head || '') + (body_result.head || '') + (footer_result.head || '')

			const page_symbols_with_js = sections
				.map((section) => ({ symbol_id: section.symbol }))
				.filter(deduplicate('symbol_id'))
				.map(({ symbol_id }) => data?.symbols.find((symbol) => symbol.id === symbol_id))
				.filter((symbol) => !!symbol)
				.filter((symbol) => !!symbol.js)
			no_js ||= page_symbols_with_js.length === 0

			// fetch module to hydrate component, include hydration data
			function fetch_modules(symbols: SiteSymbol[]) {
				return symbols
					.map(
						(symbol) =>
							`import('/_symbols/${symbol.id}.js').then(({ default: App, hydrate }) => {` +
							sections
								.filter((section) => section.symbol === symbol.id)
								.map((section) => {
									const content = section_content?.[page.id]?.[section.id]?.[locale]
									return `hydrate(App, { target: document.querySelector('#section-${section.id}'), props: ${JSON.stringify(content)} });`
								})
								.join('') +
							'}).catch(e => console.error(e));'
					)
					.join('')
			}

			// Build body with semantic wrappers
			let body_content = ''
			if (header_result.body) body_content += `<header>${header_result.body}</header>`
			body_content += `<main>${body_result.body || ''}</main>`
			if (footer_result.body) body_content += `<footer>${footer_result.body}</footer>`

			const final =
				`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="generator" content="Primo" />` +
				combined_head +
				'</head><body id="page">' +
				body_content +
				(no_js ? `` : '<script type="module">' + fetch_modules(page_symbols_with_js) + '</script>') +
				site?.foot +
				'</body></html>'

			console.log(`Successfully generated page "${page.name || page.id}"`)

			return {
				success: !!(header_result.body || body_result.body || footer_result.body),
				html: final,
				error: '',
				page_info
			}
		} catch (e) {
			error_details = e instanceof Error ? e.message : String(e)
			console.error(`Fatal error generating page "${page.name || page.id}":`, e)
			return {
				success: false,
				html: '',
				error: error_details,
				page_info
			}
		}
	}

	const shouldLoad = $derived(['loading', 'working'].includes(worker.status))
	const site = $derived(shouldLoad && site_id ? Sites.one(site_id) : undefined)
	const pages = $derived(shouldLoad && site ? site.pages() : undefined)
	const page_types = $derived(shouldLoad && site ? site.page_types() : undefined)

	const { data } = $derived(shouldLoad && site && pages ? usePageData(site, pages) : { data: undefined })

	const site_content = $derived(shouldLoad && site ? useContent(site, { target: 'live' }) : undefined)
	const page_content = $derived(
		shouldLoad && pages && pages.every((page) => !!useContent(page, { target: 'live' })) ? Object.fromEntries(pages.map((page) => [page.id, useContent(page, { target: 'live' })])) : undefined
	)
	const symbol_content = $derived(
		shouldLoad && data && data.symbols.every((symbol) => !!useContent(symbol, { target: 'live' }))
			? Object.fromEntries(data.symbols.map((symbol) => [symbol.id, useContent(symbol, { target: 'live' })]))
			: undefined
	)

	// Prepare symbol data with field keys for compilation (avoids reactive calls in worker)
	const symbols_with_field_keys = $derived(
		shouldLoad && data
			? data.symbols.map((symbol) => ({
				symbol,
				field_keys: symbol.fields()?.map((f) => f.key).filter(Boolean) ?? []
			}))
			: undefined
	)

	const sections = $derived(
		shouldLoad && pages && data
			? ([
				...data.page_type_sections.flatMap((section) =>
					pages
						.filter((page) => page.page_type === section.page_type)
						.map((page) => {
							const content = useContent(section, { target: 'live', page })
							if (!content) return

							return [page, section, content]
						})
				),
				...data.page_sections.map((section) => {
					const page = Pages.one(section.page)
					if (!page) return

					const content = useContent(section, { target: 'live', page })
					if (!content) return

					return [page, section, content]
				})
			] as ([ObjectOf<typeof PageSections> | ObjectOf<typeof PageTypeSections>, ObjectOf<typeof Pages>, NonNullable<ReturnType<typeof useContent>>] | undefined)[])
			: undefined
	)
	const section_content = $derived(
		shouldLoad && sections?.every((s) => !!s)
			? sections
				.filter((s) => !!s)
				.reduce(
					(data, [page, section, content]) => {
						if (!data[page.id]) data[page.id] = {}
						data[page.id][section.id] = content
						return data
					},
					{} as Record<string, Record<string, NonNullable<ReturnType<typeof useContent>>>>
				)
			: undefined
	)

	// In local dev, realtime subscriptions are off, so the CLI's out-of-band
	// imports (e.g. site/content.yaml on watcher events) leave the in-memory
	// list cache stale. Soft-invalidate before each run so a refetch kicks
	// off without dropping the cached ids — keeps the editor from redrawing
	// on every Build Preview click. Reopens a small race vs. fresh CLI
	// imports landing mid-publish; revisit if that bites in practice.
	const original_run = worker.run.bind(worker)
	worker.run = async (...params) => {
		self.invalidate_lists()
		return original_run(...params)
	}

	return worker
}

const deduplicate =
	<T>(key: keyof T) =>
		(item: T, index: number, array: T[]) =>
			array.findIndex((value) => value[key] === item[key]) === index
