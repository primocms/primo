import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import {supabaseAdmin} from '$lib/supabaseAdmin'
import {redirect} from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async (event) => {
    const { request } = event
    const { session } = await getSupabase(event)

    const form_data = await request.formData();
    const email = form_data.get('email');
    const password = form_data.get('password');

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      session.user.id,
      { password }
    )

    await supabaseAdmin.from('invitations').delete().match({ email })

    if (!error) {
      throw redirect(303, '/')
    }

    return { success: !error, error };
  }
};
