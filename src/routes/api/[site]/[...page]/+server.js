import { json } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin'

export async function GET({ params }) {

  const pages = params.page?.split('/') || []
  const lang = params.page[0].length === 2 ? pages.pop() : 'en' // I tried checking with '@primocms/builder/dist/const' but it didn't work on vercel
  const page_url = pages.pop() || 'index'
  //const parent_url = pages.pop() || null

  const [{ data: site_data }, { data: page_data }, { data: subpages_data, error: subpages_error }, { data: sections_data }] = await Promise.all([
    supabase_admin.from('sites').select().filter('url', 'eq', params.site).single(),
    supabase_admin.from('pages').select('*, site!inner(url)').match({ url: page_url, 'site.url': params.site }).single(),
    supabase_admin.from('pages').select('*, parent!inner(*), site!inner(url)').match({ 'site.url': params.site, 'parent.url': page_url }),
    supabase_admin.from('sections').select('*, symbol!inner(name, content), page!inner( site!inner(url) )').match({
      'page.site.url': params.site,
      // 'page.parent.url': parent_url, // we should also filter by parent but page!inner( parent!inner(url) ) is not working for some reason
      'page.url': page_url
    })
  ])

  const site = {
    // @ts-ignore
    ...site_data['content'][lang],
    _meta: {
      id: site_data.id,
      name: site_data.name,
      url: site_data.url,
      created_at: site_data.created_at
    }
  }

  const page = {
    // @ts-ignore
    ...page_data['content'][lang],
    _meta: {
      id: page_data.id,
      name: page_data.name,
      url: page_data.url,
      created_at: page_data.created_at,
      subpages: subpages_data?.map(subpage => ({
        id: subpage.id,
        name: subpage.name,
        url: subpage.url,
        created_at: subpage.created_at
      }))
    },
  }

  const sections = sections_data?.sort((a, b) => a.index - b.index).map(section => ({
    // @ts-ignore
    ...section.symbol['content'][lang], // static field values
    // @ts-ignore
    ...section['content'][lang], // dynamic field values overwrite if they exist
    _meta: {
      id: section.id,
      symbol: section.symbol.id,
      name: section.symbol.name,
      created_at: section.created_at
    }
  }))

  return json({
    site,
    page,
    sections
  })

}