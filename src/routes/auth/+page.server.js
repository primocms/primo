import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'
import {supabaseAdmin, get_row, delete_row} from '$lib/supabaseAdmin'
import {supabase, sign_up} from '$lib/supabase'

export async function load(event) {
  const { session } = await getSupabase(event)
  const signing_up = event.url.searchParams.has('signup')

  if (!session && !signing_up) {
    const {data:existing_users} = await supabaseAdmin.from('users').select('*')
    const initiated = existing_users.length > 0
    if (!initiated) {
      throw redirect(303, '?signup')
    }
  } else if (session) {
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
    const { request } = event
    const { supabaseClient } = await getSupabase(event)

    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');

    const {data:res, error} = await sign_up({email, password})
    
    if (error) {
      console.error(error)
      return {
        success: false,
        error: error.message
      }
    } else if (res) {

      // check if user already exists
      const {data:existing_users} = await supabaseAdmin.from('users').select('*')
      const admin = existing_users?.length === 0
      const email_taken = existing_users?.find(user => user.email === email)
      if (email_taken) {
        return {
          success: false,
          error: 'Email already in use'
        }
      }

      // disable email confirmation and add user
      await Promise.all([
        supabaseAdmin.auth.admin.updateUserById(
          res.user.id,
          { email_confirm: true }
        ),
        supabaseAdmin
          .from('users')
          .insert({ 
            id: res.user?.id, 
            email: res.user?.email 
          })
      ])

      // set server_owner and add user to server_members
      await Promise.all([
        admin && supabaseAdmin.from('config').update({
          value: res.user?.id
        }).eq('id', 'server_owner'),
        supabaseAdmin.from('server_members').insert({
          user: res.user?.id,
          role: 'DEV',
          admin
        })
      ])

      const {error:signin_error} = await supabaseClient.auth.signInWithPassword({email, password})

      return {
        success: !signin_error,
        error
      }
    }

  },
};