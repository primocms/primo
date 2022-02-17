import supabaseAdmin, {saveSite} from '../../supabase/admin'
import { authorizeRequest } from './_auth'

export async function get(event) {
  return await authorizeRequest(event, async () => {
    const {data,error} = await supabaseAdmin.storage
      .from('sites')
      .download(`${event.params.site}/site.json`)
    const json = JSON.stringify(await data.text())
    return {
      body: json
    }
  })
}

export async function post(event) {
  return await authorizeRequest(event, async () => {
    const {action, payload} = await event.request.json()

    if (action === 'SET_ACTIVE_EDITOR') {
      const res = await Promise.all([
        supabaseAdmin.from('sites').update({ active_editor: 'an invited user' }).eq('id', payload.siteID),
        supabaseAdmin.rpc('remove_active_editor', { site: payload.siteID })
      ])
      return {
        body: 'true'
      }
    } else if (action === 'REMOVE_ACTIVE_EDITOR') {
      await supabaseAdmin.from('sites').update({ active_editor: '' }).eq('id', payload.siteID)
      return {
        body: 'true'
      }
    } else if (action === 'SAVE_SITE') {
      const res = await saveSite(payload)
      return {
        body:  res ? 'true' : 'false'
      }
    }

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