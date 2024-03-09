import { PUBLIC_SUPABASE_PUBLIC_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import { createSupabaseLoadClient } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  event.depends('supabase:auth')
  event.depends('app:data')

  const supabase = createSupabaseLoadClient({
    supabaseUrl: PUBLIC_SUPABASE_URL,
    supabaseKey: PUBLIC_SUPABASE_PUBLIC_KEY,
    event: { fetch },
    serverSession: event?.data?.session,
  })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && !event.url.pathname.startsWith('/auth')) {
    throw redirect(303, '/auth')
  } else if (session) {
    // const site = event.params['site']
    const { sites, user } = await Promise.all([
      supabase
        .from('sites')
        .select('id, name, url, active_deployment, collaborators (*)')
        .order('created_at', { ascending: true }),
      supabase
        .from('users')
        .select('*, server_members (admin, role), collaborators (role)')
        .eq('id', session.user.id)
        .single(),
    ]).then(([{ data: sites }, { data: user }]) => {
      const [server_member] = user.server_members
      const [collaborator] = user.collaborators

      const user_final = server_member
        ? {
            ...user,
            server_member: true,
            admin: server_member.admin,
            role: server_member.role,
          }
        : {
            ...user,
            server_member: false,
            admin: false,
            role: collaborator.role,
          }

      return {
        sites: sites || [],
        user: user_final,
      }
    })

    // TODO: do this w/ sql
    const user_sites = sites?.filter(
      (site) =>
        /*user is server member*/ user.server_member ||
        /*user is site collaborator*/ site.collaborators.some(
          (collaborator) => collaborator.user === user.id
        )
    )

    return {
      supabase,
      session,
      user,
      sites: user_sites,
    }
  }
}
