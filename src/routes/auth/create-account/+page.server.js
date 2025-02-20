import supabase_admin from '$lib/supabase/admin'
import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Load} */
export async function load({ url }) {
	const email = url.searchParams.get('email')
	const { data } = await supabase_admin.from('users').select('*').eq('email', email).single()
	if (data) {
		throw redirect(303, `/auth?email=${email}`)
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form_data = await request.formData()
		const email = form_data.get('email')
		const password = form_data.get('password')

		const {data:res, error:auth_error } = await supabase_admin.auth.admin.createUser({
			email, 
			password,
			email_confirm: true
		})

		if (auth_error) {
			return {
				success: false,
				error: auth_error.message
			}
		} else if (res?.user) {
			const { data: invitation } = await supabase_admin.from('invitations').select().eq('email', email).single()
			await Promise.all([
				supabase_admin.from('invitations').delete().eq('id', invitation.id),
				supabase_admin.from('profiles').insert({
					id: res.user?.id,
					email: res.user?.email,
					is_full_user: false
				}),
				supabase_admin.from('collaborators').insert({ user: res.user.id, owner_site: invitation.site, role: invitation.role })
			])

			await supabase.auth.signInWithPassword({ email, password })
		}
	}
}
