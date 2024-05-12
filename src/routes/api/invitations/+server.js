import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'

export async function POST({ request }) {
  let user = null
  const {
    url,
    site = null,
    server_invitation,
    role,
    email,
  } = await request.json()

  const { data: existing_user, error: err } = await supabase_admin
    .from('users')
    .select('*, server_members (admin, role), collaborators (role)')
    .eq('email', email)
    .single()

  if (!err && existing_user) {
    const [server_member] = existing_user.server_members
    const [collaborator] = existing_user.collaborators

    if (server_member || (!server_invitation && collaborator.site === site)) {
      return json({ success: false, error: 'User already has access' })
    }

    user = existing_user
  } else {
    const { data, error } = await supabase_admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${url}/auth/set-password?email=${email}` }
    )

    if (!error) {
      await supabase_admin.from('users').insert({
        id: data.user.id,
        email: data.user.email,
      })
    } else {
      console.error(error)
      return json({ success: false, error: error.message })
    }
    user = data.user
  }
  // Add to 'server_members' or 'collaborators'
  const { error } = server_invitation
    ? role === 'ADMIN' ?
      await supabase_admin
        .from('server_members')
        .insert({ user: user.id, role: 'DEV', admin: true })
      : await supabase_admin
        .from('server_members')
        .insert({ user: user.id, role })
    : await supabase_admin
      .from('collaborators')
      .insert({ site, user: user.id, role })

  console.error(error)
  return json({ success: !error, error: error?.message, isNew: existing_user === null })
}

export async function DELETE({ url }) {
  const user = url.searchParams.get('user')
  const site = url.searchParams.get('site')
  const server_invitation = url.searchParams.get('server_invitation') === 'true'

  // Remove from 'server_members' or 'collaborators'
  const { error } = server_invitation ?
    await supabase_admin
      .from('server_members')
      .delete()
      .eq('user', user)
    : await supabase_admin
      .from('collaborators')
      .delete()
      .match({ user, site })

  console.error(error)
  return json({ success: !error, error: error?.message })
}

export async function PUT({ request }) { // cancel an invitation
  const {
    email,
    site = null
  } = await request.json()

  const { data: user, error: err } = await supabase_admin
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (err) return json({ success: !err, error: err?.message })

  if (site) {
    const { error } = await supabase_admin
      .from('collaborators')
      .delete()
      .match({ user: user.id, site })

    if (error) return json({ success: !error, error: error?.message })
  } else {
    const { error } = await supabase_admin
      .from('server_members')
      .delete()
      .match({ user: user.id })

    if (error) return json({ success: !error, error: error?.message })
  }

  const { data: user, error: err } = await supabase_admin
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (err) return json({ success: !err, error: err?.message })

  if (site) {
    const { error } = await supabase_admin
      .from('collaborators')
      .delete()
      .match({ user: user.id, site })

    if (error) return json({ success: !error, error: error?.message })
  } else {
    const { error } = await supabase_admin
      .from('server_members')
      .delete()
      .match({ user: user.id })

    if (error) return json({ success: !error, error: error?.message })
  }

  // Remove from 'users'
  const { data, error: err2 } = await supabase_admin.auth.admin.deleteUser(user.id)
  if (err2) return json({ success: !err2, error: err2?.message })
  const { error: err3 } = await supabase_admin
    .from('users')
    .delete()
    .match({ id: user.id })

  if (err3) return json({ success: !err3, error: err3?.message })

  // Remove from 'invitations'
  const { error } = await supabase_admin
    .from('invitations')
    .delete()
    .match({ email, site })

  console.error(error)
  return json({ success: !error, error: error?.message })
}