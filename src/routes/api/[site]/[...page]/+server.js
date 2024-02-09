import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'
import { languages } from '@primocms/builder'

export async function GET({ url, params }) {
  const pages = params.page?.split('/') || []
  const lang = languages.some((lang) => lang.key === pages[0]) ? pages.pop() : 'en'
  const page_url = pages.pop() || 'index'
  const parent_url = pages.pop() || null

  const options = {
    format: 'html', // html | markdown
    range: '0,9', // from,to # https://supabase.com/docs/reference/javascript/range
    sort: 'created_at,desc', // created_at | name, asc | desc  # default returns latest
    sections: '*', // limit the results to specific comma separated section ids
  }

  for (const p of url.searchParams) {
    if (options.hasOwnProperty(p[0])) {
      options[p[0]] = p[1]
    } else {
      return json({ error: `${p[0]} isn't a valid query parameter` })
    }
  }

  const [
    { data: site_data },
    { data: page_data },
    { data: subpages_data },
    { count: subpages_total },
    { data: sections_data },
  ] = await Promise.all([
    supabase_admin.from('sites').select().filter('url', 'eq', params.site).single(),
    supabase_admin
      .from('pages')
      .select('*, site!inner(url)')
      .match({ url: page_url, 'site.url': params.site })
      .single(),
    supabase_admin
      .from('pages')
      .select('*, parent!inner(*), site!inner(url)')
      .match({ 'site.url': params.site, 'parent.url': page_url })
      .order(options.sort.split(',')[0], {
        ascending: options.sort.split(',')[1] === 'asc',
      })
      .range(parseInt(options.range.split(',')[0]), parseInt(options.range.split(',')[1])),
    supabase_admin
      .from('pages')
      .select('*, parent!inner(url), site!inner(url)', {
        count: 'exact',
        head: true,
      })
      .match({ 'site.url': params.site, 'parent.url': page_url }),
    options.sections === '*'
      ? supabase_admin
          .from('sections')
          .select(
            parent_url
              ? `*, symbol(name, content), page!inner( url, site!inner(url), parent!inner(url) )`
              : `*, symbol(name, content), page!inner( url, site!inner(url) )`
          )
          .match({
            'page.url': page_url,
            'page.site.url': params.site,
            ...(parent_url ? { 'page.parent.url': parent_url } : {}),
          })
          .order('index')
      : supabase_admin
          .from('sections')
          .select(
            parent_url
              ? `*, symbol(name, content), page!inner( url, site!inner(url), parent!inner(url) )`
              : `*, poo:content->en, symbol(name, content), page!inner( url, site!inner(url) )`
          )
          .match({
            'page.url': page_url,
            'page.site.url': params.site,
            ...(parent_url ? { 'page.parent.url': parent_url } : {}),
          })
          .in('id', options.sections.split(','))
          .order('index'),
  ])

  const site = {
    // @ts-ignore
    ...site_data['content'][lang],
    _meta: {
      id: site_data.id,
      name: site_data.name,
      url: site_data.url,
      created_at: site_data.created_at,
    },
  }

  const page = {
    // @ts-ignore
    ...page_data['content'][lang],
    _meta: {
      id: page_data.id,
      name: page_data.name,
      url: page_data.url,
      created_at: page_data.created_at,
      subpages_total,
      subpages: subpages_data?.map((subpage) => ({
        id: subpage.id,
        name: subpage.name,
        url: subpage.url,
        created_at: subpage.created_at,
      })),
    },
  }

  format_markdown_content(sections_data, options.format)

  const sections = sections_data?.map((section) => ({
    // @ts-ignore
    ...section.symbol['content'][lang], // static field values
    // @ts-ignore
    ...section['content'][lang], // dynamic field values overwrite if they exist
    _meta: {
      id: section.id,
      symbol: section.symbol.id,
      name: section.symbol.name,
      created_at: section.created_at,
    },
  }))

  console.log({ sections_data })

  return json({
    site,
    page,
    sections,
  })
}

/**
 * Removes html or markdown from Markdown field content
 * @param {Array<import('$lib').Section> | import('$lib').Section} sections
 * @param {string} format */
function format_markdown_content(sections, format) {
  if (Array.isArray(sections)) {
    sections.forEach((item) => format_markdown_content(item, format))
  } else if (typeof sections === 'object' && sections !== null) {
    Object.keys(sections).forEach((key) => {
      if (
        typeof sections[key] === 'object' &&
        sections[key] !== null &&
        sections.hasOwnProperty(key)
      ) {
        if (
          sections[key].hasOwnProperty('html') &&
          sections[key].hasOwnProperty('markdown') &&
          Object.keys(sections[key]).length === 2
        ) {
          if (format) {
            delete sections[key]['markdown']
          } else {
            delete sections[key]['html']
          }
        } else {
          format_markdown_content(sections[key], format)
        }
      }
    })
  }
}
