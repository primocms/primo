import {createClient} from '@supabase/supabase-js'
import {find as _find} from 'lodash-es'

const supabaseAdmin = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ADMIN_KEY);


export async function getNumberOfUsers() {
  const {data,error} = await supabaseAdmin
    .from('users')
    .select('*')
  return data.length
}

export default supabaseAdmin