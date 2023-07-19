import supabase from './index'

export async function sign_up({ email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password })

  await supabase
    .from('users')
    .insert({ 
      id: data.user?.id, 
      email: data.user?.email 
    })

  // add user to server_members as admin
  await supabase.from('server_members').insert({
    user: data.user?.id,
    role: 'DEV',
    admin: true
  })

  const user = {
    id: data.user?.id,
    email,
    server_member: true,
    admin: true,
    role: 'DEV'
  }

  return {user, error}
}

export async function sign_in({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  const res = await supabase.from('users').select('*, server_members (admin, role), collaborators (role)').eq('id', data.user.id).single()
  console.log({res})

  const [server_member] = res.data.server_members
  const [collaborator] = res.data.collaborators

  const user = server_member ? {
    ...res.data,
    server_member: true,
    admin: server_member.admin,
    role: server_member.role,
  } : {
    ...res.data,
    server_member: false,
    admin: false,
    role: collaborator.role,
  }

  return {user, error}
}

export async function sign_out() {
  await supabase.auth.signOut()
}

export async function on_auth_change(fn) {
  return supabase.auth.onAuthStateChange(fn)
}

export default {
  sign_in,
  sign_up,
  sign_out,
  on_auth_change
}