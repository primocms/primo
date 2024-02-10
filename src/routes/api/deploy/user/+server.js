import { json, error as server_error } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'
import axios from 'axios'

export async function GET({ locals, url }) {
  const session = await locals.getSession()
  if (!session) {
    // the user is not signed in
    throw server_error(401, { message: 'Unauthorized' })
  }

  const provider = url.searchParams.get('provider')

  const { data: token, error } = await supabase_admin
    .from('config')
    .select('value')
    .eq('id', `${provider}_token`)
    .single()

  if (error) {
    return json(null)
  }

  let data = null
  if (provider === 'github' && token) {
    const res = await axios.get(`https://api.github.com/user`, {
      headers: {
        Authorization: `Bearer ${token.value}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    data = res.data
  } else if (provider === 'gitlab' && token) {
    const res = await axios.get(`https://gitlab.com/api/v4/user`, {
      headers: { Authorization: `Bearer ${token?.value}` },
    })
    data = res.data
  }

  return json(data)
}
