import axios from 'axios'
import { find } from 'lodash-es'
import { get } from 'svelte/store'
import supabase from './supabase/core'
import * as supabaseDB from './supabase/db'
import { sites as dbSites } from './supabase/db'
import * as supabaseStorage from './supabase/storage'
import * as stores from './stores'
import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'
import { sitePassword } from './stores/misc'

export const sites = {
  get: async (siteID, password) => {
    if (password) {
      const [dbRes, apiRes] = await Promise.all([
        dbSites.get({ id: siteID }),
        axios.get(`/api/${siteID}.json?password=${password}`)
      ])
      return {
        ...dbRes,
        ...JSON.parse(apiRes.data)
      }
    } else {
      // const res = await dbSites.get({id: siteID})
      const [dbRes, storageRes] = await Promise.all([
        dbSites.get({ id: siteID }),
        supabaseStorage.downloadSiteData(siteID)
      ])

      return {
        ...dbRes,
        ...storageRes
      }
    }
  },
  initialize: async () => {
    const sites = await supabaseDB.sites.get({ query: `id, name, password, active_deployment, host` })
    if (sites) {
      stores.sites.set(sites)
    }
  },
  create: async (newSite) => {
    await Promise.all([
      supabaseDB.sites.create({
        name: newSite.name,
        id: newSite.id
      }),
      supabaseStorage.uploadSiteData({
        id: newSite.id,
        data: newSite
      }),
      supabaseStorage.uploadPagePreview({
        path: `${newSite.id}/preview.html`,
        preview: ''
      })
    ])
    stores.sites.update(sites => [...sites, newSite])
  },
  update: async ({ id, props }) => {
    stores.sites.update(
      sites => sites.map(
        s => s.id !== id
          ? s
          : ({ ...s, ...props })
      )
    )
    await supabaseDB.sites.update(id, props)
  },
  save: async (updatedSite) => {
    stores.sites.update(sites => sites.map(site => site.id === updatedSite.id ? updatedSite : site))
    const password = get(sitePassword)
    if (password) {
      const { data } = await axios.post(`/api/${updatedSite.id}.json?password=${password}`, {
        action: 'SAVE_SITE',
        payload: updatedSite
      })
      return data
    } else {
      const homepage = find(updatedSite.pages, ['id', 'index'])
      const preview = await buildStaticPage({ page: homepage, site: updatedSite })
      const [res1, res2] = await Promise.all([
        supabaseStorage.updateSiteData({
          id: updatedSite.id,
          data: updatedSite
        }),
        supabaseStorage.updatePagePreview({
          path: `${updatedSite.id}/preview.html`,
          preview
        })
      ])
      return res1.error || res2.error ? false : true
    }
  },
  delete: async (id) => {
    stores.sites.update(sites => sites.filter(s => s.id !== id))
    await Promise.all([
      supabaseDB.sites.delete(id),
      supabaseStorage.deleteSiteData(id)
    ])
  },
  validatePassword: async (siteID, password) => {
    try {
      const { data: json } = await axios.get(`/api/${siteID}.json?password=${password}`)
      const data = JSON.parse(json)
      return data ? true : false
    } catch (e) {
      return false
    }
    // return !!data.id
  },
  publish: async ({ siteID, host, files }) => {
    const session = supabase.auth.session()
    const password = get(sitePassword)

    const { data } = await axios.post(`/api/${siteID}.json?password=${password || ''}`, {
      action: 'PUBLISH',
      payload: {
        siteID,
        host,
        files
      }
    }, {
      headers: {
        authorization: `Bearer ${session?.access_token}`
      }
    })
    if (data) {
      stores.sites.update(
        sites => sites.map(
          s => s.id !== siteID
            ? s
            : ({ ...s, active_deployment: data.deployment })
        )
      )
    }

    return data
  },
  uploadImage: async ({ siteID, image }) => {
    const session = supabase.auth.session()
    const password = get(sitePassword)

    const { data: url } = await axios.post(`/api/${siteID}.json?password=${password || ''}`, {
      action: 'UPLOAD_IMAGE',
      payload: {
        siteID,
        image
      }
    }, {
      headers: {
        authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'multipart/form-data'
      }
    })
    return url
  }
}

export const hosts = {
  initialize: async () => {
    const { data: hosts } = await axios.get('/api/hosts.json')
    if (hosts) {
      stores.hosts.set(hosts)
    }
  },
  create: async (provider) => {
    stores.hosts.update(hosts => [...hosts, provider])
    await supabaseDB.hosts.create(provider)
  },
  delete: async (name) => {
    stores.hosts.update(hosts => hosts.filter(p => p.name !== name))
    await supabaseDB.hosts.delete(name)
  }
}


let siteBeingEdited = null
export async function setActiveEditor({ siteID, lock = true, password = null }) {
  // Set the active editor and fire `remove_active_editor`, 
  // which triggers a Supabase Postgres function which 
  // waits ten seconds, then removes the active editor
  // when that returns, the function repeats
  if (lock) {
    if (siteBeingEdited === siteID) return
    siteBeingEdited = siteID
    if (password) {
      await axios.post(`/api/${siteID}.json?password=${password}`, { action: 'SET_ACTIVE_EDITOR', payload: { siteID, userID: 'an invited user' } })
    } else {
      await Promise.all([
        supabaseDB.sites.update(siteID, {
          'active_editor': get(stores.user).email
        }),
        supabase.rpc('remove_active_editor', {
          site: siteID,
        })
      ])
    }
    if (siteBeingEdited === siteID) {
      siteBeingEdited = null
      setActiveEditor({ siteID, lock, password })
    }
  } else {
    siteBeingEdited = null
    if (password) {
      axios.post(`/api/${siteID}.json?password=${password}`, { action: 'REMOVE_ACTIVE_EDITOR', payload: { siteID } })
    } else {
      supabaseDB.sites.update(siteID, {
        'active_editor': ''
      })
    }
  }
}