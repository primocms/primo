import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'

export async function POST({ request }) {
  const {
    url,
    site = null,
    server_invitation,
    role,
    email,
  } = await request.json()

  const { data, error } = await supabase_admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${url}/auth/set-password?email=${email}` }
  )

  if (!error) {
    await supabase_admin.from('users').insert({
      id: data.user.id,
      email: data.user.email,
    })

    // Add to 'server_members' or 'collaborators'
    const { error } = server_invitation
      ? await supabase_admin
          .from('server_members')
          .insert({ user: data.user.id, role })
      : await supabase_admin
          .from('collaborators')
          .insert({ site, user: data.user.id, role })

    console.error(error)
    return json({ success: !error, error: error?.message })
  } else {
    console.error(error)
    return json({ success: false, error: error.message })
  }
}
