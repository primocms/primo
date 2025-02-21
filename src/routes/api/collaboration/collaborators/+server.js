import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'
import { Resend } from 'resend'
import { PRIVATE_RESEND_KEY, PRIVATE_RESEND_EMAIL } from '$env/static/private'
const resend = new Resend(PRIVATE_RESEND_KEY)

export async function GET({ url }) {
	const site_id = url.searchParams.get('site_id')
	const res = await Promise.all([supabase_admin.from('sites').select('owner').eq('id', site_id).single(), supabase_admin.from('collaborators').select('*').eq('owner_site', site_id)])

	const owner_id = res[0].data?.owner
	const owner = await supabase_admin.auth.admin.getUserById(owner_id).then(({ data }) => {
		return {
			...res[0].data,
			email: data.user.email
		}
	})

	const collaborators = await Promise.all(
		res[1]?.data.map(async (collaborator) => {
			const { data } = await supabase_admin.auth.admin.getUserById(collaborator.user)
			return {
				...collaborator,
				email: data.user.email
			}
		})
	)

	return json([owner, ...collaborators])
}

export async function POST({ request, url }) {
	const { email, site, role } = await request.json()

	// handle existing user or new user
	const full_role = { DEV: 'developer', EDITOR: 'content editor' }[role]

	// existing user, log in automatically, send notification & log in link
	const { data: existing_user } = await supabase_admin.from('profiles').select('id').eq('email', email).single()
	const { data: owner } = await supabase_admin.auth.admin.getUserById(site.owner)

	if (existing_user) {
		const { data: user_data } = await supabase_admin.auth.admin.getUserById(existing_user.id)
		await supabase_admin.from('collaborators').insert({ owner_site: site.id, user: existing_user.id, profile: existing_user.id, role })
		await resend.emails.send({
			from: `WeaveCMS <${PRIVATE_RESEND_EMAIL}>`,
			to: [user_data.user.email],
			subject: 'Site Invitation',
			text: `You've been invited to collaborate on ${site.name} as a ${full_role} by ${owner.user.email}. ${url.origin}/${site.id}`
		})
	} else {
		await supabase_admin.from('invitations').insert({ email, owner_site: site.id, role })

		const invitation_url = `${url.origin}/auth/create-account?email=${email}`

		await resend.emails.send({
			from: `WeaveCMS <${PRIVATE_RESEND_EMAIL}>`,
			to: [email],
			subject: 'Site Invitation',
			text: `You've been invited to collaborate on ${site.name} as a ${full_role} by ${owner.user.email}. Click here to sign up: ${invitation_url}`
		})
	}

	return json({ success: true, error: null })
}
