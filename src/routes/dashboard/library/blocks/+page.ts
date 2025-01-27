import _ from 'lodash-es'
import { design_tokens } from '$lib/builder/constants'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  const { session, supabase } = await event.parent()
  if (!supabase) return

  // const site = event.params['site']
  let [{ data: settings }, { data: symbols }] = await Promise.all([
    supabase.from('library_settings').select('key, value').match({ key: 'blocks', owner: session.user.id }).single(),
    supabase.from('library_symbols').select('*, entries(*), fields(*)').eq('owner', session.user.id).order('created_at', { ascending: false })
  ])

  return {
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
