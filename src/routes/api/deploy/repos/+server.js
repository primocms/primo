import { json, error as server_error } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin'
import axios from 'axios'

export async function GET({ locals }) {

  const session = await locals.getSession()
  if (!session) {
    // the user is not signed in
    throw server_error(401, { message: 'Unauthorized' })
  }

  const {data:token} = await supabase_admin.from('config').select('value').single()

  const headers = {
  	Authorization: `Bearer ${token.value}`,
  	Accept: 'application/vnd.github.v3+json'
  }

  const res = await Promise.all([
  	axios.get(`https://api.github.com/user/repos?per_page=100`, {
  		headers: { ...headers }
  	}),
  	axios.get(`https://api.github.com/user/repos?per_page=100&page=2`, {
  		headers: { ...headers }
  	})
  ]).then((res) => res.map(({ data }) => data))

  const repos = res.flat().map((repo) => {
    return {
      id: repo.full_name,
      label: repo.name
    }
  })

  return json(repos);
}