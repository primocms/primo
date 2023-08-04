import supabase_admin from '$lib/supabase/admin'
import {redirect} from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, locals }) => {
    const { session } = locals

    const form_data = await request.formData();
    const email = form_data.get('email');
    const password = form_data.get('password');

    const { data, error } = await supabase_admin.auth.admin.updateUserById(
      session.user.id,
      { password }
    )

    await supabase_admin.from('invitations').delete().match({ email })

    if (!error) {
      throw redirect(303, '/')
    }

    return { success: !error, error };
  }
};
