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

  const { data: token } = await supabase_admin
    .from('config')
    .select('value')
    .eq('id', `${provider}_token`)
    .single()

  let repos = null
  if (provider === 'github' && token) {
    const headers = {
      Authorization: `Bearer ${token.value}`,
      Accept: 'application/vnd.github.v3+json',
    }

    const res = await Promise.all([
      axios.get(`https://api.github.com/user/repos?per_page=100`, {
        headers: { ...headers },
      }),
      axios.get(`https://api.github.com/user/repos?per_page=100&page=2`, {
        headers: { ...headers },
      }),
    ]).then((res) => res.map(({ data }) => data))

    repos = res.flat().map((repo) => ({
      id: repo.full_name,
      label: repo.name,
    }))
  } else if (provider === 'gitlab' && token) {
    const res = await axios.get('https://gitlab.com/api/v4/projects', {
      headers: { Authorization: `Bearer ${token.value}` },
      params: {
        owned: true,
        per_page: 100,
      },
    })

    repos = res.data?.map((project) => ({
      id: project.path_with_namespace,
      label: project.name,
    }))
  }

  return json(repos)
}
