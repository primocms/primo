import { createClient } from '@supabase/auth-helpers-sveltekit'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY, {
  // auth: {
  //   autoRefreshToken: true,
  //   persistSession: true,
  // },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export async function sign_up({ email, password }) {
  let { data, error } = await supabase.auth.signUp({ email, password })
  return {data, error}
}

export async function sign_in({ email, password }) {
  let { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return {data, error}
}

export async function sign_out() {
  await supabase.auth.signOut()
}

export async function get_row(table, id) {
  const { data, error } = await supabase
    .from(table)
    .select()
    .filter('id', 'eq', id)
  if (error) console.error(error)
  return data?.[0]
}

export async function create_row(table, row) {
  const { data, error } = await supabase
    .from(table)
    .insert([row])
    .select()
    .single()
  if (error) console.error(error)
  return data
}

export async function update_row(table, id, value) {
  const { data, error } = await supabase
    .from(table)
    .update(value)
    .filter('id', 'eq', id)
  if (error) {
    console.error(error)
    return false
  } else return true
}

export async function delete_row(table, id) {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .filter('id', 'eq', id)
  if (error) console.error(error)
  if (error) return false
  else return true
}
