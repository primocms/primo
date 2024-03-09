import { redirect, text } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'
import { html_server } from '../../../compiler/cloud-workers/server-compiler.js'
import postcss from '../../../compiler/cloud-workers/server-postcss.js'
import { getPageData, get_content_with_static } from '@primocms/builder'

export const GET = async (event) => {
  const { url } = event
  if (url.pathname.includes('.html')) {
    // Get site and page
    const site_url = event.params['site']
    const [parent_url = 'index', child_url] = event.params['page']?.split('/') ?? []
    const page_url = child_url ?? parent_url

    const [{ data: site }, { data: page }] = await Promise.all([
      supabase_admin.from('sites').select('*').filter('url', 'eq', site_url).single(),
      supabase_admin
        .from('pages')
        .select('*, site!inner(url)')
        .match({ 'site.url': site_url, url: page_url })
        .single(),
    ])

    console.log({ site, page, page_url })

    if (!site) {
      // throw redirect(303, '/')
    } else if (!page && page_url !== 'index') {
      throw redirect(303, `/${site_url}/index`)
    }

    // Get sorted pages, symbols, and sections
    const [{ data: symbols }, { data: sections }] = await Promise.all([
      supabase_admin
        .from('symbols')
        .select()
        .match({ site: site.id })
        .order('created_at', { ascending: false }),
      supabase_admin
        .from('sections')
        .select('id, page, index, content, symbol')
        .match({ page: page['id'] })
        .order('index', { ascending: true }),
    ])

    const locale = 'en'

    const component = await Promise.all([
      (async () => {
        const css = await postcss(site.code.css + page.code.css)
        const data = getPageData({ page, site, loc: locale })
        return {
          html: `
			      <svelte:head>
			        ${site.code.html.head}
			        ${page.code.html.head}
			        <style>${css}</style>
			      </svelte:head>`,
          css: ``,
          js: ``,
          data,
        }
      })(),
      ...sections
        .map(async (section) => {
          const symbol = symbols.find((symbol) => symbol.id === section.symbol)
          const { html, css: rawcss, js } = symbol.code
          const data = get_content_with_static({
            component: section,
            symbol,
            loc: locale,
          })
          const css = await postcss(rawcss || '')
          const section_id = section.id.split('-')[0]
          return {
            html: `
		        <div class="section" id="section-${section_id}">
		          ${html}
		        </div>`,
            js,
            css: css || '',
            data,
          }
        })
        .filter(Boolean),
      // remove options blocks
      (async () => {
        const data = getPageData({ page, site, loc: locale })
        return {
          html: site.code.html.below + page.code.html.below,
          css: ``,
          js: ``,
          data,
        }
      })(),
    ])

    const res = await html_server({
      component: component,
    })

    const final = `\
  <!DOCTYPE html>
  <html lang="${locale}">
    <head>
      <meta name="generator" content="Primo" />
      ${res.head}
      <style>${res.css}</style>
    </head>
    <body id="page">
      ${res.html}
    </body>
  </html>
  `

    // return text(final)
    return new Response(final, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    })
  }
}
