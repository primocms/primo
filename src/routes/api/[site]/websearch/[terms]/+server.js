import { json } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin'

export async function GET({ url, params }) {

  let options = {
    range: '0,9', // from,to # https://supabase.com/docs/reference/javascript/range
  }

  for (const p of url.searchParams) {
    if (options.hasOwnProperty(p[0])) {
      options[p[0]] = p[1]
    }
  }

  const [{ data: pages_data }, { count: pages_total }] = await Promise.all([
    supabase_admin.rpc('page_search', { search_terms: params.terms, site_url: params.site })
      .select('id, name, url, created_at')
      .range(parseInt(options.range.split(',')[0]), parseInt(options.range.split(',')[1])),
    supabase_admin.from('sections')
      .select('page!inner( id, site!inner(url) )', { count: 'exact', head: true })
      .eq('page.site.url', params.site)
      .textSearch('sections.content', params.terms)
  ])

  const pages = pages_data?.map(page => ({
    _meta: {
      id: page.id,
      name: page.name,
      url: '/' + page.url,
      created_at: page.created_at
    }
  }))

  return json({
    pages,
    pages_total
  })

}