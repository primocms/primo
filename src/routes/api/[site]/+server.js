import { json } from '@sveltejs/kit';
import {supabaseAdmin} from '$lib/supabaseAdmin'

export async function GET({ params }) {

  const [{data:site_res},{data:page_res},{data:subpages_data, error:subpages_error},{data:sections_res}] = await Promise.all([
    supabaseAdmin.from('sites').select().filter('url', 'eq', params.site).single(),
    supabaseAdmin.from('pages').select('*, site!inner(url)').match({ url: 'index', 'site.url': params.site }).single(),
    supabaseAdmin.from('pages').select('*, site!inner(url)').match({ 'site.url': params.site }),
    supabaseAdmin.from('sections').select('*, page!inner( site!inner(url) )').match({
      'page.site.url': params.site,
      'page.url': 'index'
    })
  ])

  const site = {
    ...site_res['content']['en'],
    _meta: {
      id: site_res.id,
      name: site_res.name,
      url: site_res.url,
      created_at: site_res.created_at
    }
  }

  const page = {
    ...page_res['content']['en'],
    _meta: {
      id: page_res.id,
      name: page_res.name,
      url: page_res.url,
      created_at: page_res.created_at,
      // filtering here because the query above is not filtering properly (maybe a Supabase bug)
      subpages: subpages_data?.filter(subpage => subpage.parent === null && subpage.url !== 'index').map(subpage => ({
        id: subpage.id,
        name: subpage.name,
        url: subpage.url,
        created_at: subpage.created_at
      }))
    },
  }


  const sections = sections_res?.sort((a,b) => a.index - b.index).map(section => ({
    ...section.content.en,
    _meta: {
      id: section.id,
      symbol: section.symbol,
      created_at: section.created_at
    }
  }))

  return json({
    site,
    page,
    sections
  })

}