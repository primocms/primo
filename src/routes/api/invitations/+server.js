import { json } from '@sveltejs/kit';
import admin from '$lib/admin_services.js'

export async function POST({ request }) {
  const {url, site = null, server_invitation, role, email} = await request.json();
  const { success, error } = await admin.create_invitation({ email, url, server_invitation, role, site })
  return json({ success, error })
}
