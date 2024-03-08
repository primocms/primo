import { redirect } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'

/** @type {import('@sveltejs/kit').Load} */
export async function load({ url, parent }) {
  const { session } = await parent()

  const signing_up = url.searchParams.has('signup')
  const joining_server = url.pathname.includes('set-password')

  if (!session && !signing_up && !joining_server) {
    const { data: existing_users } = await supabase_admin.from('users').select('*')
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
  sign_in: async ({ request, locals: { supabase } }) => {
    const data = await request.formData()
    const email = data.get('email')
    const password = data.get('password')

    const { data: res, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error(error)
      return {
        success: false,
        error: error.message,
      }
    }

    // if invitation exists, send signup to server to create user and add to workspace/editors
    return {
      success: true,
      error: null,
    }
  },
  sign_up: async ({ request, locals: { supabase } }) => {
    // Only the server owner signs up, all others are invited (i.e. auto-signed up)

    // ensure server is provisioned
    const { success, error } = await server_provisioned()
    if (!success) {
      return {
        success: false,
        error,
      }
    }

    const count = await supabase_admin
      .from('users')
      .select('count')
      .then(({ data }) => data?.[0]['count'])
    if (count > 0) {
      return {
        success: false,
        error: 'Server already initialized. Sign in as the server owner to invite users.',
      }
    }

    const data = await request.formData()
    const email = data.get('email')
    const password = data.get('password')

    const { data: res, error: auth_error } = await supabase_admin.auth.admin.createUser({
      // @ts-ignore
      email: email,
      // @ts-ignore
      password: password,
      email_confirm: true,
    })

    if (auth_error) {
      return {
        success: false,
        error: auth_error.message,
      }
    } else if (res) {
      // @ts-ignore
      const { error: signin_error } = await supabase.auth.signInWithPassword({ email, password })

      if (!signin_error) {
        // disable email confirmation and add user
        await supabase_admin.from('users').insert({
          id: res.user?.id,
          email: res.user?.email,
        })

        // add user to server_members as admin
        await supabase_admin.from('server_members').insert({
          user: res.user?.id,
          role: 'DEV',
          admin: true,
        })
      }

      return {
        success: !signin_error,
        error: signin_error?.message,
      }
    }
  },
}

async function server_provisioned() {
  const { status, error } = await supabase_admin.from('sites').select()
  if (status === 0) {
    return {
      success: false,
      error: `Could not connect your Supabase backend. Ensure you've correctly connected your environment variables.`,
    }
  } else if (status === 404) {
    console.error(error)
    return {
      success: false,
      error: `Your Supabase backend is connected but incorrectly provisioned. Ensure you've run the setup schema outlined in the Docs.`,
    }
  } else if (status === 200) {
    // has sites or no sites
    return { success: true, error: null }
  } else {
    return { success: false, error: `Unknown error` }
  }
}
