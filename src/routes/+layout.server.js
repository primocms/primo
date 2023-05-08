import { getServerSession } from '@supabase/auth-helpers-sveltekit'

/** @type {import('@sveltejs/kit').ServerLoad} */
export async function load(event) {
  return {
    session: await getServerSession(event),
  }
}