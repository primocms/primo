/** @type {import('@sveltejs/kit').ServerLoad} */
// import { redirect } from '@sveltejs/kit';
import supabase_admin from '$lib/supabase/admin'

export const load = async ({ url, locals: { supabase, getSession } }) => {
	return {
		session: await getSession()
	}
}
