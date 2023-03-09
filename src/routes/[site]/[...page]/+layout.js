import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:data')
  const { session, supabaseClient } = await getSupabase(event)

  if (!session) {
    return { page: null }
  } 
  
  const site_id = event.params['site'] 
  const page_url = event.params['page'] 

  const {data:page} = await supabaseClient.from('pages').select().match({url: page_url, site: site_id})
  const {data:sections} = await supabaseClient.from('sections').select('*, symbol (*)').match({page: page?.[0]['id']})

  const ordered_sections = sections?.sort((a, b) => {
    if (a.index === b.index) {
      return new Date(a.created_at) - new Date(b.created_at)
    } else {
      return a.index - b.index
    }
  })

  return {
    page: page?.[0],
    sections: ordered_sections
  }
}