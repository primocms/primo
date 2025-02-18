// import { getSupabase } from '@supabase/auth-helpers-sveltekit';
import { PUBLIC_SUPABASE_PUBLIC_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import { createSupabaseLoadClient } from '@supabase/auth-helpers-sveltekit'
import _ from 'lodash-es'
import { redirect } from '@sveltejs/kit'


/** @type {import('@sveltejs/kit').Load} */
export async function load(event) {
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
		return {}
	}

	// const site = event.params['site']
	const [{ data: sites }, {data: starters}, { data: profile }] = await Promise.all([
		supabase.from('sites').select('*').order('created_at', { ascending: true }).match({ is_starter: false }),
		supabase.from('sites').select('*').order('created_at', { ascending: true }).match({ is_starter: true }),
		supabase.from('profiles').select('*').eq('id', session.user.id).single()
	])

	// redirect collaborators to their respective site (no dashboard access)
	if (!profile.is_full_user) {
		throw redirect(307, `/${sites?.[0].id}`);
	}

	return {
		supabase,
		session,
		user: {
			...profile,
			...session.user,
			collaborator: false
		},
		sites,
		starters
		// subscriptions
	}
}
