import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Load} */
export async function load({ depends, params, parent }) {
  depends('app:data')

  const { supabase, session } = await parent()

  if (!session) {
    // the user is not signed in
    throw redirect(303, '/auth')
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

  return {
    site,
    page,
    pages,
    sections,
    symbols
  }
}