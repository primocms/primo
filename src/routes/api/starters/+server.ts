import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'

export async function GET() {
  const res = await supabase_admin
    .from('sites')
    .select('*')
    .match({ is_starter: true })

  const sites = await Promise.all(
    res.data?.map(async site => {
      const { data } = await supabase_admin.storage.from('sites').download(`${site.id}/preview.html`)
      const preview = await data?.text()
      return { id: site.id, data: site, preview }
    }) || []
  )

  return json(sites, {
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
