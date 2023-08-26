import supabase_admin from '$lib/supabase/admin'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, locals: { supabase } }) => {
    const form_data = await request.formData()
    const email = form_data.get('email')
    const password = form_data.get('password')

    const { data } = await supabase_admin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    const { error } = await supabase_admin.auth.admin.updateUserById(data.id, {
      password,
    })

    await supabase_admin.from('invitations').delete().match({ email })

    if (!error) {
      await supabase.auth.signInWithPassword({ email, password })
      throw redirect(303, '/')
    }

    return { success: !error, error }
  },
}
