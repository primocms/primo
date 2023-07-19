import { redirect } from '@sveltejs/kit'
import admin from '$lib/admin_services'

/** @type {import('@sveltejs/kit').ServerLoad} */
export async function load(event) {
  const signing_up = event.url.searchParams.has('signup')
  const accepting_invitation = event.url.pathname.includes('set-password')

  if (!signing_up && !accepting_invitation) {
    const initiated = await admin.server_initiated()
    if (!initiated) {
      throw redirect(303, '?signup')
    }
  } else if (signing_up && !accepting_invitation) {
    const { success, error } = await admin.server_provisioned()
    return {
      success, 
      error
    }
  }
}