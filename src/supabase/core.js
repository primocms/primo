import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public';
import { createClient } from '@supabase/auth-helpers-sveltekit'

// Create a single supabase client for interacting with your database, auth, and storage
export default createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY)