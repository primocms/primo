import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:data')

  const { session, supabaseClient } = await getSupabase(event)
  if (!session) {
    throw redirect(303, '/auth')
  }

  // Get site
  const site_url = event.params['site'] 
  const {data:site} = await supabaseClient.from('sites').select().filter('url', 'eq', site_url).single()

  if (!site) return

  // Get page
  const page_url = 'index'
  const {data:page} = await supabaseClient.from('pages').select('*').match({ site: site.id, url: page_url }).single()

  // Get sorted pages, symbols, and sections
  const { pages, symbols, sections } = await Promise.all([
    supabaseClient.from('pages').select().match({site: site.id}),
    supabaseClient.from('symbols').select().match({site: site.id}),
    supabaseClient.from('sections').select('id, page, index, content, symbol (*)').match({page: page['id']}),
  ]).then(([{data:pages}, {data:symbols}, {data:sections}]) => ({
    pages: pages?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    symbols: symbols?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    sections: sections?.sort((a, b) => a.index - b.index )
  }))

  return {
    site,
    page,
    pages,
    sections,
    symbols
  }
}