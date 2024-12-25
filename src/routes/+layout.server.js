/** @type {import('@sveltejs/kit').ServerLoad} */
export const load = async ({ url, locals: { supabase, getSession } }) => {
	return {
		session: await getSession()
	}
}
