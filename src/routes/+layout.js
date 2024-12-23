// import { getSupabase } from '@supabase/auth-helpers-sveltekit';
import { PUBLIC_SUPABASE_PUBLIC_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import { createSupabaseLoadClient } from '@supabase/auth-helpers-sveltekit'
import { redirect } from '@sveltejs/kit'
import _ from 'lodash-es'

/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
	if (event.url.pathname.startsWith('/auth/github')) return

	event.depends('app:data')

	const supabase = createSupabaseLoadClient({
		supabaseUrl: PUBLIC_SUPABASE_URL,
		supabaseKey: PUBLIC_SUPABASE_PUBLIC_KEY,
		event: { fetch },
		serverSession: event?.data?.session
	})
	const {
		data: { session }
	} = await supabase.auth.getSession()

	if (!session) {
		console.log('no session')
		// redirect(303, '/auth')
	}

	// const { session, supabaseClient } = await getSupabase(event);
	if (!session && !event.url.pathname.startsWith('/auth') && event.url.pathname !== '/payment-succeeded') {
		// Get site and page
		// const { site: site_id, page_type: page_type_id } = event.params
		return {
			...event.data,
			session: null,
			user: {
				role: 'DEV',
				email: 'user@email.com'
			}
		}
	} else if (session) {
		// const site = event.params['site']
		const [{ data: sites }, { data: profile }] = await Promise.all([
			supabase.from('sites').select('*').order('created_at', { ascending: true }),
			supabase.from('profiles').select('*').eq('id', session.user.id).single()
			// supabase.from('subscriptions').select('*, site ( name, custom_domain )').eq('user', session.user.id)
		])

		return {
			supabase,
			session,
			user: {
				...profile,
				...session.user,
				collaborator: false
			},
			sites
			// subscriptions
		}
	}
}
