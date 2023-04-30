import { json } from '@sveltejs/kit';
import {supabaseAdmin} from '$lib/supabaseAdmin'

export async function POST({ request }) {
  const {url, site = null, server_invitation, role, email} = await request.json();

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: `${url}/auth/set-password?email=${email}` })

  if (!error) {

    await supabaseAdmin
      .from('users')
      .insert({ 
        id: data.user.id, 
        email: data.user.email 
      })
    
    // Add to 'server_members' or 'collaborators'
    const {error} = server_invitation ? 
      await supabaseAdmin.from('server_members').insert({ user: data.user.id, role }) :
      await supabaseAdmin.from('collaborators').insert({ site, user: data.user.id, role })

    console.error(error)
    return json({success: !error, error: error?.message});
  } else {
    console.error(error)
    return json({success: false, error: error.message});
  }

}
