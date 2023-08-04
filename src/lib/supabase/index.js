import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js'

export default createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY)