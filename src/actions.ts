import axios from 'axios'
import { find } from 'lodash-es'
import { get } from 'svelte/store'
import supabase from './supabase/core'
import * as supabaseDB from './supabase/db'
import { sites as dbSites } from './supabase/db'
import * as supabaseStorage from './supabase/storage'
import * as stores from './stores'
import { buildStaticPage } from '$lib/editor/stores/helpers'
import { sitePassword } from './stores/misc'

export const sites = {
  get: async (siteID, password) => {
    // const res = await dbSites.get({id: siteID})
    const [dbRes, storageRes] = await Promise.all([
      dbSites.get({ id: siteID }),
      supabaseStorage.downloadSiteData(siteID)
    ])

    return {
      ...dbRes,
      ...storageRes
    }
  },
  initialize: async () => {
    const sites = await supabaseDB.sites.get({ query: `id, name, password, active_deployment, host` })
    const userAllowedSites = get(stores.user)['sites']
    if (!userAllowedSites) { // all sites allowed
      stores.sites.set(sites)
    } else {
      const filtered = sites.filter(site => userAllowedSites.includes(site.id))
      stores.sites.set(filtered)
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
  },
  delete: async (id) => {
    stores.sites.update(sites => sites.filter(s => s.id !== id))
    await Promise.all([
      supabaseDB.sites.delete(id),
      supabaseStorage.deleteSiteData(id)
    ])
  },
  addUser: async ({ site, password, user }) => {
    // send server adduser request
    const { data: success } = await axios.post(`/api/${site}?password=${password}`, {
      action: 'ADD_USER',
      payload: user
    })
    return success
  },
  removeUser: async ({ site, user }) => {
    // send server adduser request
    const { data, error } = await supabase.auth.getSession()
    const { data: success } = await axios.post(`/api/${site.id}`, {
      action: 'REMOVE_USER',
      payload: user
    }, {
      headers: {
        authorization: `Bearer ${data.session.access_token}`
      }
    })
    return success
  },
  validatePassword: async (siteID, password) => {
    try {
      const { data: json } = await axios.get(`/api/${siteID}?password=${password}`)
      const data = JSON.parse(json)
      return data ? true : false
    } catch (e) {
      return false
    }
    // return !!data.id
  },
  publish: async ({ siteID, host, files }) => {
    const { data: auth } = await supabase.auth.getSession()

    // upload files to supabase storage for later retrieval from server
    files = await Promise.all(
      files.map(file => supabaseStorage.uploadSiteFile({
        id: siteID,
        file
      }))
    )

    const { data: { body } } = await axios.post(`/api/${siteID}`, {
      action: 'PUBLISH',
      payload: {
        siteID,
        host,
        files
      }
    }, {
      headers: {
        authorization: `Bearer ${auth.session.access_token}`
      }
    })

    if (body) {
      stores.sites.update(
        sites => sites.map(
          s => s.id !== siteID
            ? s
            : ({ ...s, active_deployment: body.deployment })
        )
      )
    } else {
      alert('Could not publish site')
    }

    return body
  },
  uploadImage: async ({ siteID, image }) => {
    const { data: auth } = await supabase.auth.getSession()
    const password = get(sitePassword)

    const { data: { body: url } } = await axios.post(`/api/${siteID}?password=${password || ''}`, {
      action: 'UPLOAD_IMAGE',
      payload: {
        siteID,
        image
      }
    }, {
      headers: {
        authorization: `Bearer ${auth.session.access_token}`,
        'Content-Type': 'multipart/form-data'
      }
    })
    return url
  }
}

export const hosts = {
  initialize: async () => {
    const { data: hosts } = await axios.get('/api/hosts')
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

export const users = {

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
    await Promise.all([
      supabaseDB.sites.update(siteID, {
        'active_editor': get(stores.user).email
      }),
      supabase.rpc('remove_active_editor', {
        site: siteID,
      })
    ])
    if (siteBeingEdited === siteID) {
      siteBeingEdited = null
      setActiveEditor({ siteID, lock, password })
    }
  } else {
    siteBeingEdited = null
    supabaseDB.sites.update(siteID, {
      'active_editor': ''
    })
  }
}


export async function setCustomization(options, update_on_server = true) {
  stores.config.update(c => ({
    ...c,
    customization: {
      ...c.customization,
      ...options
    }
  }))
  if (update_on_server) {
    supabaseDB.config.update({
      id: 'customization',
      options: get(stores.config)['customization']
    })
  }
}