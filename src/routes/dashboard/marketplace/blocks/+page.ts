import axios from 'axios'

export async function load() {
  const { data } = await axios.get('https://weave-marketplace.vercel.app/api/blocks')
  return {
    settings: data.settings,
    symbols: data.symbols || []
  }
} 