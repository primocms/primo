import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'
import {supabaseAdmin, get_row, delete_row} from '$lib/supabaseAdmin'
import {sign_up} from '$lib/supabase'
// import {join_workspace, sign_up} from '$lib/supabase'

export async function load(event) {
  const { session } = await getSupabase(event)
  if (session) {
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
    const invitation_id = data.get('invitation_id');

    const {data:res, error} = await supabaseClient.auth.signInWithPassword({email, password})

    if (error) {
      console.error(error)
      return {
        success: false,
        error: error.message
      }
    }

    // if invitation exists, send signup to server to create user and add to workspace/editors
    if (invitation_id) {
      // const success = await join_workspace(invitation_id, res.user.id)
      // return {
      //   success,
      //   error: success ? null : 'Could not join workspace'
      // }
    } else {
      return {
        success: true,
        error: null
      }
    }

  },
  sign_up: async (event) => {
    const { url, request } = event
    const { supabaseClient } = await getSupabase(event)

    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    const invitation_id = data.get('invitation_id');

    // if invitation exists, send signup to server to create user and add to workspace/editors
    const invitation = invitation_id ? (await get_row('invitations', invitation_id)) : null

    if (invitation_id && !invitation) { 
      return {
        success: false,
        error: 'Invitation not found'
      }
    }

    const {data:res, error} = await sign_up({email, password})
    
    if (error) {
      console.error(error)
      return {
        success: false,
        error: error.message
      }
    } else {
      // create user and workspace
      await supabaseAdmin
        .from('users')
        .insert({ 
          id: res.user.id, 
          email: res.user.email 
        })
      await supabaseAdmin
        .from('workspaces')
        .insert({ 
          owner: res.user.id,
          name: 'My Workspace',
        })

      // add editor if invitation exists
      if (invitation) {
        // await join_workspace(invitation_id, res)
      } 

      const {error:signin_error} = await supabaseClient.auth.signInWithPassword({email, password})

      return {
        success: !signin_error,
        error
      }
    }

  },
};
