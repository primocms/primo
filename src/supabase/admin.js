import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_PRIVATE_KEY } from '$env/static/private';
import {createClient} from '@supabase/supabase-js'
import {find as _find} from 'lodash-es'

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_PRIVATE_KEY);


export async function getNumberOfUsers() {
  const {data,error} = await supabaseAdmin
    .from('users')
    .select('*')
  return data.length
}

export default supabaseAdmin