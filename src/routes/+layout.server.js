import supabaseAdmin from '../supabase/admin'

// Preload customization options
export async function load() {
  const {data} = await supabaseAdmin.from('config').select('*').eq('id', 'customization')
  if (data && data[0]) {
    return data[0]['options'];
  } else return null
}