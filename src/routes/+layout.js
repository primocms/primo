import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:data')
  const { session, supabaseClient } = await getSupabase(event)
  if (!session && event.url.pathname !== '/auth') {
    throw redirect(303, '/auth')
  } else if (session) {
    // const site = event.params['site'] 
    const {sites, user, config} = await Promise.all([
      supabaseClient.from('sites').select('id, name, url, owner, pages (preview), collaborators (*)'),
      supabaseClient.from('users').select('*, server_members (admin, role)').eq('id', session.user.id).single(),
      supabaseClient.from('config').select('*')
    ]).then(([{data:sites},{data:user},{data:config}]) => {
      const [server_member] = user.server_members
      return {
        sites, 
        user: server_member ? {
          ...user,
          server_member: true,
          admin: server_member.admin,
          role: server_member.role,
        } : user, 
        config
      }
    })

    // TODO: do this w/ sql
    const user_sites = sites?.filter(site => 
      /*user is server member*/ user.server_member ||
      /*user owns site*/ site.owner === user.id || 
      /*user is collaborator*/ site.collaborators.some(collaborator => collaborator.user === user.id) 
    )

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