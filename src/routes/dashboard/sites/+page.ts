import _ from 'lodash-es'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  const { supabase } = await event.parent()
  if (!supabase) return

  const { data } = await supabase.from('sites').select('*').order('created_at', { ascending: false }).match({ is_starter: false })
  return {
    sites: data
  }
}
