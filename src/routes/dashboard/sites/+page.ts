import { redirect } from '@sveltejs/kit'

export async function load(event) {
  const { site_groups } = await event.parent()
  const group_id = event.url.searchParams.get('group')
  const group_exists = site_groups.find(g => String(g.id) === group_id)
  if (!group_exists) {
    throw redirect(307, `/dashboard/sites?group=${site_groups[0].id}`)
  }
} 