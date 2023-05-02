import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_PRIVATE_KEY } from '$env/static/private';
import {createClient} from '@supabase/supabase-js'

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_PRIVATE_KEY);

export default supabaseAdmin