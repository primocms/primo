import supabase_authentication_service from '$lib/providers/supabase/authentication'
import supabase_database_service from '$lib/providers/supabase/database'
import supabase_storage_service from '$lib/providers/supabase/storage'

export const database = {
  'SUPABASE': supabase_database_service
}['SUPABASE']

export const authentication = {
  'SUPABASE': supabase_authentication_service
}['SUPABASE']

export const storage = {
  'SUPABASE': supabase_storage_service
}['SUPABASE']