import { redirect, error } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Load} */
export async function load({ depends, params, parent }) {
  depends('app:data')

  const { supabase, session } = await parent()

  if (!session) {
    // the user is not signed in
    throw error(401, { message: 'Unauthorized' })
  }

  // Get site and page
  const site_url = params['site']
  const client_params = params['page']?.split('/') || null
  const page_url = (client_params === null) ? 'index' : client_params.pop()

  const [{ data: site }, { data: page }] = await Promise.all([
    supabase.from('sites').select().filter('url', 'eq', site_url).single(),
    supabase.from('pages').select('*, site!inner(id, url)').match({ 'site.url': site_url, url: page_url }).single()
  ])

  if (!site) {
    throw redirect(303, '/')
  } else if (!page && page_url !== 'index') {
    throw redirect(303, `/${site_url}/index`)
  }

  // Get sorted pages, symbols, and sections
  const [{ data: pages }, { data: symbols }, { data: sections }] = await Promise.all([
    supabase.from('pages').select().match({ site: site.id }).order('created_at', { ascending: true }),
    supabase.from('symbols').select().match({ site: site.id }).order('index', { ascending: true }),
    supabase.from('sections').select('id, page, index, content, symbol').match({ page: page['id'] }).order('index', { ascending: true }),
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