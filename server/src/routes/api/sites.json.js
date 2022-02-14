import supabaseAdmin from '../../supabase/admin'
import { authorizeRequest } from './_auth'

export async function get(req) {
  return await authorizeRequest(req, async () => {
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