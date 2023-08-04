import { json } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin'

export async function GET({ params }) {
  
  const [{data:site_data},{data:page_data},{data:subpages_data, error:subpages_error},{data:sections_data}] = await Promise.all([
    supabase_admin.from('sites').select().filter('url', 'eq', params.site).single(),
    supabase_admin.from('pages').select('*, site!inner(url)').match({ url: params.page, 'site.url': params.site }).single(),
    supabase_admin.from('pages').select('*, parent!inner(*), site!inner(url)').match({ 'site.url': params.site, 'parent.url': params.page }),
    supabase_admin.from('sections').select('*, page!inner( site!inner(url) )').match({
      'page.site.url': params.site,
      'page.url': params.page
    })
  ])

  const site = {
    ...site_data['content']['en'],
    _meta: {
      id: site_data.id,
      name: site_data.name,
      url: site_data.url,
      created_at: site_data.created_at
    }
  }

  const page = {
    ...page_data['content']['en'],
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

  const sections = sections_data?.sort((a,b) => a.index - b.index).map(section => ({
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