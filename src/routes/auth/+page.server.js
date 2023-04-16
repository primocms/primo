import { getSupabase } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'
import {supabaseAdmin, get_row, delete_row} from '$lib/supabaseAdmin'
import {supabase, sign_up} from '$lib/supabase'
// import {join_workspace, sign_up} from '$lib/supabase'

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
      const success = await accept_invitation(invitation_id, res)
      return {
        success,
        error: success ? null : 'Could not join site'
      }
    } else {
      return {
        success: true,
        error: null
      }
    }

  },
  sign_up: async (event) => {
    const { request } = event
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
    console.log({res})
    
    if (error) {
      console.error(error)
      return {
        success: false,
        error: error.message
      }
    } else if (res) {
      // create user and workspace
      const {data:existing_users} = await supabaseAdmin.from('users').select('*')
      const admin = existing_users?.length === 0
      const email_taken = existing_users?.find(user => user.email === email)
      console.log({existing_users, admin, email_taken})
      if (email_taken) {
        console.log('returning false')
        return {
          success: false,
          error: 'Email already in use'
        }
      }
      await supabaseAdmin
      .from('users')
      .insert({ 
        id: res.user?.id, 
        email: res.user?.email 
      }),
      await supabaseAdmin.from('server_members').insert({
        user: res.user?.id,
        role: 'DEV',
        admin
      })

      // add editor if invitation exists
      if (invitation) {
        await accept_invitation(invitation_id, res.user)
      } 

      const {error:signin_error} = await supabaseClient.auth.signInWithPassword({email, password})

      return {
        success: !signin_error,
        error
      }
    }

  },
};

async function accept_invitation(invitation_id, invitee) {
  const {site, email, server_invitation, role} = await get_row('invitations', invitation_id)

  // if invitation email matches, add user to site/server
  if (email === invitee.email) {

    const {error} = server_invitation ? 
      await supabase.from('server_members').insert({ user: invitee.id, role }) :
      await supabase.from('collaborators').insert({ site, user: invitee.id, role, server_member: server_invitation })

    if (!error) {
      // delete invitation
      await delete_row('invitations', invitation_id)
      return true
    } else {
      return false
    }
  }
}