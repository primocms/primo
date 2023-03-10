import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:data')
  const { session, supabaseClient } = await getSupabase(event)
  if (!session && event.url.pathname !== '/auth') {
    throw redirect(303, '/auth')
  } else if (session) {
    // const site = event.params['site'] 
    const {data:sites} = await supabaseClient.from('sites').select('*, pages (preview)').eq('pages.url', 'index')
    return {
      session,
      sites: sites?.map(s => ({ ...s, preview: s.pages[0]?.['preview']})),
    }
  }
}