import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'

export async function GET() {
  // const site = event.params['site']
  const res = await Promise.all([
    supabase_admin.from('library_settings').select('key, value').eq('key', 'blocks').single(),
    supabase_admin.from('library_symbols').select('*, entries(*), fields(*)')
  ])

  console.log({ res })

  const symbols = await Promise.all(
    res[1].data?.map(async symbol => {
      const { data } = await supabase_admin.storage.from('symbols').download(`${symbol.id}/preview.html`)
      const preview = await data?.text()
      return { id: symbol.id, data: symbol, preview }
    }) || []
  )

  return json({
    settings: res[0].data,
    symbols
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  })
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  })
}
