import axios from 'axios'
import { redirect } from '@sveltejs/kit'

export async function load(event) {
  const { marketplace_symbol_groups } = await event.parent()

  const group_id = event.url.searchParams.get('group')
  const group_exists = marketplace_symbol_groups.find(g => String(g.id) === group_id)
  if (!group_id || !group_exists) {
    throw redirect(307, `/dashboard/marketplace/blocks?group=${marketplace_symbol_groups[0].id}`)
  }

  // const { data } = await axios.get('https://weave-marketplace.vercel.app/api/blocks')
  try {
    const { data } = await axios.get(`http://weave-marketplace.vercel.app/api/symbol_groups/${group_id}`)
    return {
      marketplace_symbols: data
    }
  } catch (e) {
    throw redirect(307, `/dashboard/marketplace/starters}`)
  }
} 
