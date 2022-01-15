import {createClient} from '@supabase/supabase-js'
import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'
import {find as _find} from 'lodash-es'

const supabaseAdmin = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ADMIN_KEY);

export async function getServerToken() {
  const {data,error} = await supabaseAdmin
    .from('config')
    .select('*')
    .eq('id', 'server-token')
  return data[0]['value']
}

export async function validateSitePassword(siteID, password) {
  const {data,error} = await supabaseAdmin
    .from('sites')
    .select('*')
    .eq('password', password)
    .eq('id', siteID)
  return !!data[0]
}

export async function getNumberOfUsers() {
  const {data,error} = await supabaseAdmin
    .from('users')
    .select('*')
  return data.length
}

export async function validateInvitationKey(key) {
  console.log({key})
  const {data,error} = await supabaseAdmin
    .from('config')
    .select('*')
    .eq('id', 'invitation-key')
    .eq('value', key)
  return !!data[0]
}

export async function saveSite(updatedSite) {
  const homepage = _find(updatedSite.pages, ['id', 'index'])
  const preview = await buildStaticPage({ page: homepage, site: updatedSite })
  const [ res1, res2 ] = await Promise.all([
    updateSiteData({
      id: updatedSite.id,
      data: updatedSite
    }),
    updatePagePreview({
      path: `${updatedSite.id}/preview.html`,
      preview
    })
  ])
  return res1.error || res2.error ? false : true

  async function updateSiteData({ id, data }) {
    const json = JSON.stringify(data)
    return await supabaseAdmin
      .storage
      .from('sites')
      .update(`${id}/site.json`, json, {
        upsert: true
      })
  }

  async function updatePagePreview({ path, preview }) {
    return await supabaseAdmin
    .storage
    .from('sites')
    .update(path, preview, {
      upsert: true
    })
  }
}

export default supabaseAdmin