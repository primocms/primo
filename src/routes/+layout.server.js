import supabaseAdmin from '../supabase/admin'
import { getServerSession } from '@supabase/auth-helpers-sveltekit'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  const {data} = await supabaseAdmin.from('config').select('*').eq('id', 'customization')
  if (data && data[0]) {
    return {
    ...data[0]['options'],
    session: await getServerSession(event),
    }
  } else return {
    session: await getServerSession(event),
  }
}