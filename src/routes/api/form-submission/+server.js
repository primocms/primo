import { json } from '@sveltejs/kit'
import _ from 'lodash-es'
import supabase_admin from '$lib/supabase/admin'
import { Resend } from 'resend'
import { PRIVATE_RESEND_KEY } from '$env/static/private'
const resend = new Resend(PRIVATE_RESEND_KEY)

export async function POST(event) {
	const form_id = event.url.searchParams.get('id')
	const form_data = await event.request.json()

	await supabase_admin.from('form_submissions').insert({ form: form_id, data: form_data })
	const { data: form } = await supabase_admin.from('forms').select().eq('id', form_id).single()
	const { data: site } = await supabase_admin.from('sites').select().eq('id', form?.site).single()
	const [{ data: user }, { data: collaborators }] = await Promise.all([
		supabase_admin.from('users').select().eq('id', site?.owner).single(),
		supabase_admin.from('collaborators').select('user(email)').eq('site', site?.id)
	])

	const collaborator_emails = collaborators?.map((c) => c.user.email) || []
	const all_recipients = _.uniq([...collaborator_emails, user.email, ...form.recipients])

	await resend.emails.send({
		from: 'breezly.io <noreply@cloud.primocms.org>',
		to: all_recipients,
		subject: `New Form Submission > ${form.name}`,
		text: Object.entries(form_data).map(([key, value]) => `${key}: ${value}`).join(`
`)
	})

	return json(
		{ success: true, error: null },
		{
			headers: {
				'Access-Control-Allow-Origin': '*'
			}
		}
	)
}
