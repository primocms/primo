import { get } from 'svelte/store'
import { storageChanged } from '$lib/builder/database'
import site from '$lib/builder/stores/data/site'
import pages from '$lib/builder/stores/data/pages'
import sections from '$lib/builder/stores/data/sections'
// import symbols from '$lib/builder/stores/data/symbols'
import active_page from '$lib/builder/stores/data/page'
import * as code_generators from '$lib/builder/code_generators'
import { processCode } from '$lib/builder/utils'
import { get_content_with_synced_values } from '$lib/builder/stores/helpers'
import _ from 'lodash-es'
import {supabase} from '$lib/supabase'

export async function update_page_file(update_all = false) {
	const all_pages = get(pages)
	if (update_all) {
		await Promise.all(
			all_pages.map(async (page) => {
				const { data = [] } = await supabase.from('sections').select('*, page, entries(*), master(id, symbol, index)').match({ page: page.id }).order('index', { ascending: true })
				await generate_and_upload_page(page, data)
			})
		)
	} else {
		const page = get(active_page)
		await generate_and_upload_page(page, get(sections))
	}


	async function generate_and_upload_page(page, page_sections) {
		// order sections
		let ordered_sections = []

		// get mastered sections
		const mastered_sections = page_sections.filter((s) => s.master)

		// @ts-ignore
		for (const section of mastered_sections.sort((a, b) => a.master.index - b.master.index)) {
			// if has symbol, add like normal
			if (section.master?.symbol) {
				ordered_sections.push({
					...section,
					index: section.master.index
				})
			}

			// if is master palette, insert palette sections, ordered by index
			if (!section.master?.symbol) {
				const palette_sections = page_sections.filter((s) => s.palette).sort((a, b) => a.index - b.index)
				// palette_sections.index = page_sections.master.index
				ordered_sections.push(...palette_sections)
			}
		}


		// then sort by index and flatten

		const { html } = await code_generators.page_html({
			page,
			page_sections: ordered_sections
		})


		let path
		if (page.slug === '') {
			path = `index.html`
		} else {
			path = `${get_full_path(page, all_pages)}/index.html`
		}

		const file = new File([html], 'index.html', { type: 'text/html; charset=utf-8' });

		await storageChanged({
			action: 'upload',
			key: path,
			file
		})

		// save site preview
		if (page.slug === '') {
			const { data, error } = await supabase.storage.from('sites').upload(`${get(site).id}/preview.html`, file, { upsert: true })
		}

	}

	// let json_path
	// if (page.slug === '') {
	// 	json_path = `page.json`
	// } else {
	// 	json_path = `${get_full_path(page, all_pages)}/page.json`
	// }

	// const page_data = {
	// 	id: page.id,
	// 	data: transform_content({ fields: page.page_type.fields, entries: page.entries }).en,
	// 	sections: ordered_sections.map(section => {
	// 		const symbol = get(symbols).find(symbol => symbol.id === section.symbol)
	// 		console.log({symbol, symbols: get(symbols)})
	// 		const data = transform_content({ fields: symbol.fields, entries: section.entries }).en
	// 		return { id: section.id, data, _meta: { symbol: symbol.id} }
	// 	})
	// }

	// const page_json = JSON.stringify(page_data)
  // const json_file = new File([page_json], 'page.json', { type: 'application/json' });
	// await storageChanged({
	// 	action: 'upload',
	// 	key: json_path,
	// 	file: json_file
	// })

}

export async function update_symbol_file(symbol) {
	const data = get_content_with_synced_values({
		entries: symbol.entries,
		fields: symbol.fields
	})
	const res = await processCode({
		component: {
			html: symbol.code.html,
			css: symbol.code.css,
			js: symbol.code.js,
			data: data['en']
		}
	})

	if (res.error) {
		console.warn('Error processing symbol', symbol.name)
	}
	const date = new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}).format(new Date())

  const path = '_symbols/' + symbol.id + '.js'
  const content = `// ${symbol.name} - Updated ${date}\n\n` + res.js

  const blob = new Blob([content], { type: 'application/javascript' });
  const file = new File([blob], 'index.html', { type: 'application/javascript' });

	await storageChanged({
		action: 'upload',
		key: path,
		file
	})
}

export async function update_sitemap() {
  const {custom_domain} = get(site)
  if (!custom_domain) return 

  const all_pages = get(pages)
  const base_url = `https://${custom_domain}` 

  const sitemap_entries = all_pages.map(page => {
    let url = base_url
    const page_path = get_full_path(page, all_pages)
    console.log({page_path})
    if (page.slug !== '') {
      url += `/${page_path}`
    }
    return `
  <url>
    <loc>${url}</loc>
  </url>`
  }).join('')

  const sitemap_content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap_entries}
</urlset>`

  const file = new File([sitemap_content], 'sitemap.xml', { type: 'application/xml; charset=utf-8' })

  await storageChanged({
    action: 'upload',
    key: 'sitemap.xml',
    file
  })
}


function get_full_path(page, pages, path = page?.slug || '') {
  const parent = pages.find(p => p.id === page.parent)
  if (!parent) return path
  
  return get_full_path(parent, pages, parent.slug + '/' + path)
}
