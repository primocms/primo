import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  event.depends('app:data')

  const { session, supabaseClient } = await getSupabase(event)
  if (!session) {
    throw redirect(303, '/auth')
  }

  // Get site and page
  const site_url = event.params['site']
  const client_params = event.params['page']?.split('/') || null
  const page_url = (client_params === null) ? 'index' : client_params.pop()

  const [{ data: site }, { data: page }] = await Promise.all([
    supabaseClient.from('sites').select().filter('url', 'eq', site_url).single(),
    supabaseClient.from('pages').select('*, site!inner(id, url)').match({ 'site.url': site_url, url: page_url }).single()
  ])

  if (!site) {
    throw redirect(303, '/')
  } else if (!page && page_url !== 'index') {
    throw redirect(303, `/${site_url}/index`)
  }

  // Get sorted pages, symbols, and sections
  const [{ data: pages }, { data: symbols }, { data: sections }] = await Promise.all([
    supabaseClient.from('pages').select().match({ site: site.id }).order('created_at', { ascending: true }),
    supabaseClient.from('symbols').select().match({ site: site.id }).order('index', { ascending: true }),
    supabaseClient.from('sections').select('id, page, index, content, symbol').match({ page: page['id'] }).order('index', { ascending: true }),
  ])
  
  // Check to ensure symbols have an index column (v2.0.0--beta.12)
  if (!symbols) {
    return {
      alert: `Your database is misconfigured and needs a quick change to support the latest version of Primo. Please run the following query from your Supabase SQL Editor, then refresh this page.
      <pre>alter table symbols\nadd column index integer;</pre><br>
      See the <a target="blank" href="https://primocms.org/changelog">release notes</a> for more info or ask for help in our <a target="blank" href="https://discord.gg/RmjYqDq">Discord</a>.`
    }
  }

  return {
    site,
    page,
    pages,
    sections,
    symbols
  }
}