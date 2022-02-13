import * as supabaseDB from '../../supabase/db'
import supabaseAdmin, {saveSite} from '../../supabase/admin'
import { authorizeRequest } from './_auth'

export async function get(req) {
  return await authorizeRequest(req, async () => {
    const {data,error} = await supabaseAdmin.storage
      .from('sites')
      .download(`${req.params.site}/site.json`)
    const json = JSON.stringify(await data.text())
    return {
      body: json
    }
  })
}

export async function post(req) {
  return await authorizeRequest(req, async () => {
    const res = await saveSite(req.body)
    return {
      body:  res ? 'true' : 'false'
    }
  })
}