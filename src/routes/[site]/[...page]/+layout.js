import { getSupabase } from '@supabase/auth-helpers-sveltekit'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  event.depends('app:data')
  const { session, supabaseClient } = await getSupabase(event)

  if (!session) {
    return { page: null }
  } 
  
  const site_url = event.params['site'] 
  const page_url = event.params['page'] 

  const {data:page} = await supabaseClient.from('pages').select('*, pages (id), site!inner(*)').match({
    url: page_url,
    'site.url': site_url
  }).single()

  if (!page) return {
    page: null,
    site: null
  }
  const {data:sections} = await supabaseClient.from('sections').select('id, page, index, content, symbol (*)').match({page: page.id})

  const ordered_sections = sections?.sort((a, b) => {
    if (a.index === b.index) {
      return new Date(a.created_at) - new Date(b.created_at)
    } else {
      return a.index - b.index
    }
  })

  return {
    page,
    sections: ordered_sections
  }
}