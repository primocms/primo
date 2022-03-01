import supabaseAdmin, {saveSite} from '../../supabase/admin'
import { authorizeRequest } from './_auth'
import {publishSite} from './_utils'

export async function get(event) {
  return await authorizeRequest(event, async () => {
    const {data,error} = await supabaseAdmin.storage
      .from('sites')
      .download(`${event.params.site}/site.json?${Date.now()}`)
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
        supabaseAdmin.from('sites').update({ active_editor: payload.userID }).eq('id', payload.siteID),
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
    } else if (action === 'PUBLISH') {
      const { siteID, files, host } = payload
      // get active_deployment from db
      const {data} = await supabaseAdmin.from('hosts').select('*').eq('name', host)
      const deployment = await publishSite({
        siteID: siteID,
        host: data[0],
        files: files,
        activeDeployment: null
      })
      if (deployment) {
        const {data,error} = await supabaseAdmin.from('sites').update({ 
          active_deployment: {
            [host]: deployment
          } 
        }).eq('id', siteID)
        if (error) console.error(error)
        return {
          body: {
            deployment
          }
        }
      } else {
        return {
          body: {
            deployment: null
          }
        }
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