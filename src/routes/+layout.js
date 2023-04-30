import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'
import _ from 'lodash'

export const load = async (event) => {
  event.depends('app:data')
  const { session, supabaseClient } = await getSupabase(event)
  if (!session && !event.url.pathname.startsWith('/auth')) {
    throw redirect(303, '/auth')
  } else if (session) {
    // const site = event.params['site'] 
    const {sites, user, config} = await Promise.all([
      supabaseClient.from('sites').select('id, name, url, owner, pages (url, preview), collaborators (*)'),
      supabaseClient.from('users').select('*, server_members (admin, role), collaborators (role)').eq('id', session.user.id).single(),
      supabaseClient.from('config').select('*')
    ]).then(([{data:sites},{data:user},{data:config}]) => {
      const [server_member] = user.server_members
      const [collaborator] = user.collaborators

      const user_final = server_member ? {
        ...user,
        server_member: true,
        admin: server_member.admin,
        role: server_member.role,
      } : {
        ...user,
        server_member: false,
        admin: false,
        role: collaborator.role,
      }

      return {
        sites, 
        user: user_final, 
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
        ...s, 
        preview: _.find(s.pages, { url: 'index' })?.preview, 
        role: s.collaborators.find(c => c.user === user.id)?.role 
      })),
      config: Object.fromEntries(config.map(c => [c.id, {
        value: c.value,
        options: c.options
      }]))
    }
  }
}