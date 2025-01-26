import _ from 'lodash-es'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  const { supabase } = await event.parent()
  if (!supabase) return

  // const site = event.params['site']
  const [{ data: settings }, { data: symbols }] = await Promise.all([
    supabase.from('library_settings').select('key, value').eq('key', 'blocks').single(),
    supabase.from('library_symbols').select('*, entries(*), fields(*)').order('created_at', { ascending: false })
  ])

  return {
    settings,
    symbols
  }
}
