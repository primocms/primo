import axios from 'axios'

export async function load() {
  // const { data } = await axios.get('https://weave-marketplace.vercel.app/api/blocks')
  const { data } = await axios.get('http://localhost:5174/api/blocks')
  console.log({ data })
  return {
    settings: data.settings,
    symbols: data.symbols || []
  }
} 