import { json, error as server_error } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin'
import axios from 'axios'

export async function POST({ request, locals }) {

  const session = await locals.getSession()
  if (!session) {
    // the user is not signed in
    throw server_error(401, { message: 'Unauthorized' })
  }

  const {site} = await request.json();
  const repo_url = site.active_deployment.repo.url
  const user_id = session.user.id

  // verify user is collaborator on site or server member
  const [ {data:collaborator}, {data:server_member} ] = await Promise.all([
    supabase_admin.from('collaborators').select('*').match({ site: site.id, user: user_id }).single(),
    supabase_admin.from('server_members').select('*').eq('user', user_id).single()
  ])

  if (collaborator || server_member) {
    const {data:token} = await supabase_admin.from('config').select('value').single()

    if (!token) {
      return json({success: false, error: 'No token found' });
    }

    const success = await axios.delete(repo_url, {
      headers: {
        Authorization: `token ${token.value}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    .catch(function (error) {
      console.warn(`Github API error: ${error.message}`)
      return null
    })

    return json({ success: true, error: null });
  } else {
    return json({ success: false, error: 'Unauthorized' });
  }

}