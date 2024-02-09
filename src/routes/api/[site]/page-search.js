import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'

/** @param {URL} url */
/** @param {string} site_url */
export default async function page_search(url, site_url) {
  const options = {
    range: '0,9', // from,to # https://supabase.com/docs/reference/javascript/range
    search: '',
  }

  for (const p of url.searchParams) {
    if (options.hasOwnProperty(p[0])) {
      options[p[0]] = p[1]
    }
  }

  if (!options.search) {
    return json({
      error: 'The search query cannot be empty',
    })
  } else {
    const [{ data: pages_data, error }, { count: pages_total }] = await Promise.all([
      supabase_admin
        .rpc('page_search', {
          search_terms: options.search.replaceAll(' ', ' & '),
          site_url,
        })
        .select('id, name, url, created_at')
        .range(parseInt(options.range.split(',')[0]), parseInt(options.range.split(',')[1])),
      supabase_admin.rpc(
        'page_search',
        {
          search_terms: options.search.replaceAll(' ', ' & '),
          site_url,
        },
        { count: 'exact', head: true }
      ),
    ])

    // RPC doesn't exist
    if (error) {
      return json({
        error: `The page_search RPC hasn't been added`,
      })
    }

    const pages = pages_data?.map((page) => ({
      _meta: {
        id: page.id,
        name: page.name,
        url: '/' + page.url,
        created_at: page.created_at,
      },
    }))

    return json({
      pages,
      pages_total,
    })
  }
}
