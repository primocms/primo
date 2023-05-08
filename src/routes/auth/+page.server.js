import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'
import {supabaseAdmin, get_row, delete_row} from '$lib/supabaseAdmin'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
  const {session} = await getSupabase(event)
  const signing_up = event.url.searchParams.has('signup')
  const joining_server = event.url.pathname.includes('set-password')

  if (!session && !signing_up && !joining_server) {
    const {data:existing_users} = await supabaseAdmin.from('users').select('*')
    const initiated = existing_users?.length > 0
    if (!initiated) {
      throw redirect(303, '?signup')
    }
  } else if (session && !joining_server) {
    throw redirect(303, '/')
  }
}

/** @type {import('./$types').Actions} */
export const actions = {
  sign_in: async (event) => {
    const { request } = event
    const { supabaseClient } = await getSupabase(event)

    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');

    const {data:res, error} = await supabaseClient.auth.signInWithPassword({email, password})

    if (error) {
      console.error(error)
      return {
        success: false,
        error: error.message
      }
    }

    // if invitation exists, send signup to server to create user and add to workspace/editors
    return {
      success: true,
      error: null
    }

  },
  sign_up: async (event) => {
    // Only the server owner signs up, all others are invited (i.e. auto-signed up)

    const { request } = event
    const { supabaseClient } = await getSupabase(event)

    // ensure server is provisioned
    const {success, error} = await server_provisioned()
    if (!success) {
      return {
        success: false,
        error
      }
    }

    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');

    const {data:res, error:auth_error} = await supabaseAdmin.auth.admin.createUser({
      // @ts-ignore
      email: email,
      // @ts-ignore
      password: password,
      email_confirm: true,
    });

    if (auth_error) {
      return {
        success: false,
        error: auth_error.message
      }
    } else if (res) {

      // @ts-ignore
      const {error:signin_error} = await supabaseClient.auth.signInWithPassword({email, password})

      if (!signin_error) {
          // disable email confirmation and add user
        await supabaseAdmin
          .from('users')
          .insert({ 
            id: res.user?.id, 
            email: res.user?.email 
          })

        // add user to server_members as admin
        await supabaseAdmin.from('server_members').insert({
          user: res.user?.id,
          role: 'DEV',
          admin: true
        })
      }

      return {
        success: !signin_error,
        error: signin_error?.message
      }
    }

  },
};

async function server_provisioned() {
  const {status, error} = await supabaseAdmin
    .from('sites')
    .select()

  console.log(status)
  if (status === 0) {
    return { success: false, error: `Could not connect your Supabase backend. Ensure you've correctly connected your environment variables.` }
  } else if (status === 404) {
    console.error(error);
    return { success: false, error: `Your Supabase backend is connected but incorrectly provisioned. Ensure you've run the setup schema outlined in the Docs.` }
  } else if (status === 200) { // has sites or no sites
    return { success: true, error: null }
  } else {
    return { success: false, error: `Unknown error` }
  }
}