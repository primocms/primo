import { redirect } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
	const { session } = await event.parent()
	if (session) {
		throw redirect(303, '/')
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	sign_up: async (event) => {
		const { request, locals } = event
		const { supabase } = locals

		const data = await request.formData()
		const email = data.get('email')
		const password = data.get('password')

		const { data: res, error } = await supabase.auth.signUp({ email, password })

		if (res) {
			await supabase.from('users').insert({ id: res.user?.id, email })
		}

		return {
			success: !error,
			error: error?.message
		}
	},
	sign_in: async (event) => {
		const { request, locals } = event
		const { supabase } = locals
		// const { supabaseClient } = await getSupabase(event);

		const data = await request.formData()
		const email = data.get('email')
		const password = data.get('password')

		const { data: res, error } = await supabase.auth.signInWithPassword({ email, password })

		if (error) {
			console.error(error)
			return {
				success: false,
				error: error.message
			}
		}

		// if invitation exists, send signup to server to create user and add to workspace/editors
		return {
			success: true,
			error: null
		}
	},
	reset_password: async (event) => {
		const { request, locals } = event
		const { supabase } = locals

		const data = await request.formData()
		const email = data.get('email')

		const res = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${event.url.origin}/auth?reset&email=${email}`
		})
		return {
			success: !res.error,
			error: res.error
		}
	},
	confirm_password_reset: async (event) => {
		const data = await event.request.formData()
		const password = data.get('password')
		if (!password) {
			return {
				success: false,
				error: 'Password cannot be blank'
			}
		}
		const res = await event.locals.supabase.auth.updateUser({
			password
		})
		return {
			success: !res.error,
			error: res.error
		}
	}
}
