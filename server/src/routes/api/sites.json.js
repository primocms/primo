import supabaseAdmin from '../../supabase/admin'
import { authorizeRequest } from './_auth'

export async function GET(event) {
  return await authorizeRequest(event, async () => {
    let finalSites = []
    const {data:sites} = await supabaseAdmin.from('sites').select('*')
    await Promise.all(
      sites.map(async site => {
        const {data:res} = await supabaseAdmin.storage.from('sites').download(`${site.id}/site.json?${Date.now()}`) // bust the cache (i.e. prevent outdated data)
        const json = await res.text()
        const data = JSON.parse(json)
      
        finalSites = [
          ...finalSites,
          {
            ...site,
            data
          }
        ]
      })
    )
    return {
      body: {
        sites: finalSites
      }
    };
  })
}

export async function options() {
  return {
    headers: {
			'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  }
}