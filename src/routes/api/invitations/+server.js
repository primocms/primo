import { json } from '@sveltejs/kit';
import { PRIVATE_MAILGUN_KEY, PRIVATE_MAILGUN_EMAIL } from '$env/static/private';
import mailgun from 'mailgun-js'
import html from './invitation_email'

const mg = mailgun({apiKey: PRIVATE_MAILGUN_KEY, domain: PRIVATE_MAILGUN_EMAIL});
const data = {
	from: `Primo <noresponse@${PRIVATE_MAILGUN_EMAIL}>`,
	subject: 'Invitation'
};

export async function POST({ request }) {
  const {id, site, url, inviter_email, email} = await request.json();

  data.to = email
  data.html = html({
    invitation_id: id,
    site_name: site.name,
    url,
    inviter_email,
    email
  })

  const success = await new Promise((resolve) => {
    mg.messages().send(data, (error, body) => {
      console.log({error, body})
      if (body) {
        resolve(true)
      } else if (error) {
        resolve(false)
      }
    });
  })

  return json(success);
}
