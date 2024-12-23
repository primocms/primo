import '$lib/supabase'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public'
import { createSupabaseServerClient } from '@supabase/auth-helpers-sveltekit'
import { download_file } from './download_file'
import { redirect } from '@sveltejs/kit'

const ignore_paths = ['auth', 'payment-succeeded']

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

	const marketing_pages = ['/']
	if (!session && marketing_pages.includes(event.url.pathname)) {
		const file_name = event.url.pathname === '/' ? '/index.html' : event.url.pathname
		const file_name_with_extension = file_name.slice(1) + (file_name.includes('.') ? '' : '/index.html') // remove beginning slash for s3

		const file = await download_file('178.primo.page', file_name_with_extension)
		if (file) {
			return new Response(file.body, {
				headers: { 'Content-Type': file.type }
			})
		}
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
