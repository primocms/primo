import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

export const load = async (event) => {
  event.depends('app:email')

  const { session, supabaseClient } = await getSupabase(event)
  if (!session) {
    throw redirect(303, '/auth')
  }

  const email_id = event.params['email'] 
  let {data} =  await supabaseClient.from('emails').select(`id, name, updated_at, created_at, data`).filter('id', 'eq', email_id)
  const email = data?.[0] 

  return {
    email
  }
}