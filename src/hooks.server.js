import '$lib/supabase'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public'
import { createSupabaseServerClient } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ resolve, event }) {
	if (event.url.pathname.startsWith('/_symbols')) {
		return new Response('', {
			headers: { 'Content-Type': 'text/javascript' }
		})
	}

	event.locals.supabase = createSupabaseServerClient({
		supabaseUrl: PUBLIC_SUPABASE_URL,
		supabaseKey: PUBLIC_SUPABASE_PUBLIC_KEY,
		event
	})

	event.locals.getSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession()
		return session
	}

	const session = await event.locals.getSession()
	if (!session && !event.url.pathname.endsWith('/auth')) {
		redirect(303, '/auth')
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range'
		}
	})

	// console.log(event.request.method)
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers': 'Content-Type, Accept' // Specify allowed headers
			}
		})
	}

	return response
}
