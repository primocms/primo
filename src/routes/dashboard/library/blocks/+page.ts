import { redirect } from '@sveltejs/kit'

export async function load(event) {
  const { symbol_groups } = await event.parent()
  const group_id = event.url.searchParams.get('group')
  const group_exists = symbol_groups.find(g => String(g.id) === group_id)
  if (!group_exists) {
    throw redirect(307, `/dashboard/library/blocks?group=${symbol_groups[0].id}`)
  }
} 