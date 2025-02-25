import { redirect } from '@sveltejs/kit'

export async function load() {
  throw redirect(307, '/dashboard/sites');
} 