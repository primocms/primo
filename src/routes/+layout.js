import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:data')
  const { session, supabaseClient } = await getSupabase(event)
  if (!session && event.url.pathname !== '/auth') {
    throw redirect(303, '/auth')
  } else if (session) {
    // const site = event.params['site'] 
    const [{data:sites},{data:user},{data:config}] = await Promise.all([
      supabaseClient.from('sites')
      .select('id, name, url, owner, pages (preview), collaborators (*)')
      .eq('pages.url', 'index'),
      supabaseClient.from('users').select('*').eq('id', session.user.id).single(),
      supabaseClient.from('config').select('*')
    ])

    const user_sites = sites?.filter(s => s.collaborators.some(c => c.user === user.id) || s.owner === user.id)

    return {
      session,
      user,
      sites: user_sites?.map(s => ({ 
        ...s, preview: s.pages[0]?.['preview'], 
        role: s.collaborators.find(c => c.user === user.id)?.role 
      })),
      config: Object.fromEntries(config.map(c => [c.id, {
        value: c.value,
        options: c.options
      }]))
    }
  }
}