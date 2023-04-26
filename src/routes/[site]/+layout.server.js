import { getServerSession } from '@supabase/auth-helpers-sveltekit'

export const load = async (event) => {
  return {
    session: await getServerSession(event),
  }
}