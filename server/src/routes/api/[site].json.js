import supabaseAdmin, {saveSite} from '../../supabase/admin'
import { authorizeRequest } from './_auth'
import {publishSite} from './_utils'
import {decode} from 'base64-arraybuffer'

export async function get(event) {
  return await authorizeRequest(event, async () => {
    const {data} = await supabaseAdmin.storage
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
    } else if (action === 'UPLOAD_IMAGE') {
      const { siteID, image } = payload
      await supabaseAdmin
        .storage
        .from('sites')
        .upload(`${siteID}/assets/${image.name}`, decode(image.base64), {
          contentType: 'image/png'
        })
  
      const { publicURL } = await supabaseAdmin
        .storage
        .from('sites')
        .getPublicUrl(`${siteID}/assets/${image.name}`)

      return {
        body: publicURL
      }
    }  else if (action === 'SAVE_SITE') {
      const res = await saveSite(payload)
      return {
        body:  res ? 'true' : 'false'
      }
    } else if (action === 'PUBLISH') {
      const { siteID, files, host } = payload
      // get active_deployment from db
      const [{data:hosts}, {data:siteData}] = await Promise.all([
        supabaseAdmin.from('hosts').select('*').eq('name', host.name),
        supabaseAdmin.from('sites').select('*').eq('id', siteID)
      ])
      const [{ active_deployment }] = siteData
      const {deployment, error} = await publishSite({
        siteID: siteID,
        host: hosts[0],
        files,
        activeDeployment: active_deployment
      })
      if (deployment) {
        const {data,error} = await supabaseAdmin.from('sites').update({ 
          active_deployment: deployment
        }).eq('id', siteID)
        if (error) console.error(error)
        return {
          body: {
            deployment,
            error: null
          }
        }
      } else {
        return {
          body: {
            deployment: null,
            error
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