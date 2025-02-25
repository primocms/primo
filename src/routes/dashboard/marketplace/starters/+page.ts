import axios from 'axios'
import { redirect } from '@sveltejs/kit'

export async function load() {
  const { data } = await axios.get('https://weave-marketplace.vercel.app/api/starters')
  return {
    starters: data || []
  }
} 