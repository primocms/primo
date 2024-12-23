import _ from 'lodash-es'
import { get } from 'svelte/store'
import { locale } from '$lib/builder/stores/app/misc'
import stores, { update_timeline } from '$lib/builder/stores/data'
import { content as site_content, site } from '$lib/builder/stores/data/site'
import { dataChanged } from '$lib/builder/database'

export async function add_language(key) {
	await update_timeline({
		doing: async () => {
			site_content.update((s) => ({
				...s,
				[key]: s['en']
			}))

			stores.pages.update((store) =>
				store.map((page) => ({
					...page,
					content: {
						...page.content,
						[key]: page.content['en']
					}
				}))
			)

			stores.symbols.update((store) =>
				store.map((symbol) => ({
					...symbol,
					content: {
						...symbol.content,
						[key]: symbol.content['en']
					}
				}))
			)

			stores.sections.update((store) =>
				store.map((section) => ({
					...section,
					content: {
						...section.content,
						[key]: section.content['en']
					}
				}))
			)

			// add language to page, site, and sections content
			await Promise.all([
				await dataChanged({
					table: 'sites',
					action: 'update',
					id: get(site)['id'],
					data: {
						content: {
							...get(site).content,
							[key]: get(site).content['en']
						}
					}
				}),
				...get(stores.symbols).map(async (symbol) => {
					await dataChanged({
						table: 'symbols',
						action: 'update',
						id: symbol.id,
						data: {
							content: {
								...symbol.content,
								[key]: symbol.content['en']
							}
						}
					})
				}),
				...get(stores.pages).map(async (page) => {
					await dataChanged({
						table: 'sections',
						action: 'select',
						match: { page: page.id },
						order: ['index', { ascending: true }]
					}).then(async (all_sections) => {
						all_sections.map(async (section) => {
							await dataChanged({
								table: 'sections',
								action: 'update',
								id: section.id,
								data: {
									content: {
										...section.content,
										[key]: section.content['en']
									}
								}
							})
						})
					}),
						await dataChanged({
							table: 'pages',
							action: 'update',
							id: page.id,
							data: {
								content: {
									...page.content,
									[key]: page.content['en']
								}
							}
						})
				})
			])
		},
		undoing: async () => {
			locale.set('en')

			site_content.update((s) => {
				delete s[key]
				return s
			})

			stores.pages.update((store) =>
				store.map((page) => {
					delete page.content[key]
					return page
				})
			)

			stores.sections.update((store) =>
				store.map((section) => {
					delete section.content[key]
					return section
				})
			)

			stores.symbols.update((store) =>
				store.map((symbol) => {
					delete symbol.content[key]
					return symbol
				})
			)

			await Promise.all([
				await dataChanged({
					table: 'sites',
					action: 'update',
					id: get(site)['id'],
					data: {
						content: get(site_content)
					}
				}),
				...get(stores.sections).map(async (section) => {
					await dataChanged({
						table: 'sections',
						action: 'update',
						id: section.id,
						data: {
							content: section.content
						}
					})
				}),
				...get(stores.pages).map(async (page) => {
					await dataChanged({
						table: 'sections',
						action: 'select',
						match: { page: page.id },
						order: ['index', { ascending: true }]
					}).then(async (all_sections) => {
						all_sections.map(async (section) => {
							delete section.content[key]
							await dataChanged({
								table: 'sections',
								action: 'update',
								id: section.id,
								data: {
									content: section.content
								}
							})
						})
					})

					await dataChanged({
						table: 'pages',
						action: 'update',
						id: page.id,
						data: {
							content: page.content
						}
					})
				})
			])
		}
	})
}

export async function delete_language(key) {
	locale.set('en')

	const original = {
		site_content: _.cloneDeep(get(site_content)),
		pages: _.cloneDeep(get(stores.pages)),
		sections: _.cloneDeep(get(stores.sections)),
		symbols: _.cloneDeep(get(stores.symbols))
	}

	update_timeline({
		doing: async () => {
			site_content.update((s) => {
				delete s[key]
				return s
			})

			stores.pages.update((store) =>
				store.map((page) => {
					delete page.content[key]
					return page
				})
			)

			stores.sections.update((store) =>
				store.map((section) => {
					delete section.content[key]
					return section
				})
			)

			stores.symbols.update((store) =>
				store.map((symbol) => {
					delete symbol.content[key]
					return symbol
				})
			)

			await Promise.all([
				await dataChanged({
					table: 'sites',
					action: 'update',
					id: get(site)['id'],
					data: {
						content: get(site_content)
					}
				}),
				...get(stores.sections).map(async (section) => {
					await dataChanged({
						table: 'sections',
						action: 'update',
						id: section.id,
						data: {
							content: section.content
						}
					})
				}),
				...get(stores.pages).map(async (page) => {
					await dataChanged({
						table: 'pages',
						action: 'update',
						id: page.id,
						data: {
							content: page.content
						}
					})
				})
			])
		},
		undoing: async () => {
			site_content.set(original.site_content)
			stores.pages.set(original.pages)
			stores.sections.set(original.sections)
			stores.symbols.set(original.symbols)

			await Promise.all([
				await dataChanged({
					table: 'sites',
					action: 'update',
					id: get(site)['id'],
					data: {
						content: get(site_content)
					}
				}),
				await dataChanged({
					table: 'sections',
					action: 'upsert',
					data: get(stores.sections).map((section) => ({
						id: section.id,
						content: section.content
					}))
				}),
				await dataChanged({
					table: 'pages',
					action: 'upsert',
					data: get(stores.pages).map((page) => ({
						id: page.id,
						content: page.content
					}))
				})
			])
		}
	})
}

export async function set_language(loc) {
	locale.set(loc)
}
