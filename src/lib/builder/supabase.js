import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY, {
  // auth: {
  //   autoRefreshToken: true,
  //   persistSession: true,
  // },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
