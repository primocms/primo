import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:data')

  const { session, supabaseClient } = await getSupabase(event)
  if (!session) {
    throw redirect(303, '/auth')
  }

  const site_id = event.params['site'] 
  const page_url = 'index'

 const {data:page} = await supabaseClient.from('pages').select().match({ site: site_id, url: page_url })

  // let {data} =  await supabaseClient.from('sites').select(`id, name, created_at, data, page:data->pages->index`).filter('id', 'eq', site_id)
  const [{data:site}, {data:pages}, {data:symbols}, {data:sections}] = await Promise.all([
    await supabaseClient.from('sites').select().filter('id', 'eq', site_id),
    await supabaseClient.from('pages').select().match({site: site_id}),
    await supabaseClient.from('symbols').select().match({site: site_id}),
    await supabaseClient.from('sections').select('id, page, index, content, symbol (*)').match({page: page?.[0]['id']}),
  ]) 

  const ordered_sections = sections?.sort((a, b) => {
    if (a.index === b.index) {
      return new Date(a.created_at) - new Date(b.created_at)
    } else {
      return a.index - b.index
    }
  })

  const ordered_pages = pages?.sort((a, b) => {
    return new Date(a.created_at) - new Date(b.created_at)
  })

  return {
    site: {
      id: site?.[0]['id'],
      ...site?.[0]
    },
    pages: ordered_pages,
    page: page?.[0],
    sections: ordered_sections,
    symbols
  }
}