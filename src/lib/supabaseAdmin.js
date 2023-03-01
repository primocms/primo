import { createClient } from '@supabase/auth-helpers-sveltekit'
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_PRIVATE_KEY } from '$env/static/private';

export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_PRIVATE_KEY)

export async function get_row(table, id) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select()
    .filter('id', 'eq', id)
  if (error) {
    console.error(error)
    return []
  } else return data[0]
}

export async function update_row(table, id, value) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .update(value)
    .filter('id', 'eq', id)
  if (error) {
    console.error(error)
    return false
  } else return true
}

export async function delete_row(table, id) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .delete()
    .filter('id', 'eq', id)
  if (error) console.error(error)
  console.log({data, error})
  if (error) return false
  else return true
}

export async function create_row(table, row) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .insert([row])
    .select()
  if (error) console.error(error)
  console.log({data})
  return data?.[0]
}