import _ from 'lodash-es'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  const { session, supabase } = await event.parent()
  if (!supabase) return

  const [{ data: starters }, { data: sites }, { data: settings }, { data: symbols }] = await Promise.all([
    supabase.from('sites').select('*').order('created_at', { ascending: false }).match({ is_starter: true, owner: session.user.id }),
    supabase.from('sites').select('*').order('created_at', { ascending: false }).match({ is_starter: false, owner: session.user.id }),
    supabase.from('library_settings').select('key, value').match({ key: 'blocks', owner: session.user.id }).single(),
    supabase.from('library_symbols').select('*, group(*), entries(*), fields(*)').eq('owner', session.user.id).order('created_at', { ascending: false })
  ])

  return {
    starters,
    sites,
    settings: settings?.value || {
      head: '',
      design: {
        heading_font: 'Open Sans',
        body_font: 'Open Sans',
        brand_color: '#1E3D59',
        accent_color: '#FF6E40',
        roundness: '4px',
        depth: '0px 4px 30px rgba(0, 0, 0, 0.2)'
      }
    },
    symbols
  }
}
