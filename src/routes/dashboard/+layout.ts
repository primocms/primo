import _ from 'lodash-es'
import axios from 'axios'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  const { session, supabase } = await event.parent()
  if (!supabase) return

  const is_marketplace = event.url.pathname.startsWith('/dashboard/marketplace')

  if (is_marketplace) {
    const { data: marketplace_symbol_groups } = await axios.get('https://weave-marketplace.vercel.app/api/symbol_groups')
    return {
      marketplace_symbol_groups
    }
  } else {
    const [{ data: starters }, { data: site_groups }, { data: settings }, { data: symbol_groups }] = await Promise.all([
      supabase.from('sites').select('*').order('created_at', { ascending: false }).match({ is_starter: true, owner: session.user.id }),
      supabase.from('site_groups').select('*, sites!inner(*)').match({ 'sites.is_starter': false }).order('created_at', { ascending: false }).match({ owner: session.user.id }),
      supabase.from('library_settings').select('key, value').match({ key: 'blocks', owner: session.user.id }).single(),
      supabase.from('library_symbol_groups').select(`*, symbols:library_symbols(*, entries(*), fields(*))`).eq('owner', session.user.id).order('created_at', { ascending: false }),
    ])
    return {
      starters,
      site_groups,
      settings: settings?.value || {
        head: '',
        design: {
          heading_font: 'Open Sans',
          body_font: 'Open Sans',
          primary_color: '#1E3D59',
          radius: '4px',
          shadow: '0px 4px 30px rgba(0, 0, 0, 0.2)'
        }
      },
      symbol_groups
    }
  }
}
