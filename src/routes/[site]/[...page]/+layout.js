import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:data')
  const { session, supabaseClient } = await getSupabase(event)

  if (!session) {
    return { page: null }
  } 
  
  const site_url = event.params['site'] 
  const page_url = event.params['page'] 

  const {data:page} = await supabaseClient.from('pages').select('*, pages (id), sites (*)').eq('url', page_url).eq('sites.url', site_url).single()
  const {data:sections} = await supabaseClient.from('sections').select('*, symbol (*)').match({page: page.id})

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