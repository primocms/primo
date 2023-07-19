import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public';

export default createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})