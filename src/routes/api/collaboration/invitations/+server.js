import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'
import { Resend } from 'resend'
import { PRIVATE_RESEND_KEY } from '$env/static/private'
const resend = new Resend(PRIVATE_RESEND_KEY)

export async function GET({ url }) {
	const site_id = url.searchParams.get('site_id')
	const { data: invitations } = await supabase_admin.from('invitations').select('*').eq('site', site_id)
	return json(invitations)
}
