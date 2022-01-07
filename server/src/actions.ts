import axios from 'axios'
import {find} from 'lodash-es'
import * as supabaseDB from './supabase/db'
import {sites as dbSites} from './supabase/db'
import * as supabaseStorage from './supabase/storage'
import * as stores from './stores'
import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'

export const sites = {
  get: async (siteID, password) => {
    if (password) {
      const [ dbRes, apiRes ] = await Promise.all([
        dbSites.get({id: siteID}), 
        axios.get(`/api/${siteID}.json?password=${password}`)
      ])
      return {
        ...dbRes,
        ...JSON.parse(apiRes.data)
      }
    } else {
      // const res = await dbSites.get({id: siteID})
      const [ dbRes, storageRes ] = await Promise.all([
        dbSites.get({id: siteID}),
        supabaseStorage.downloadSiteData(siteID)
      ]) 

      return {
        ...dbRes,
        ...storageRes
      }
    }
  },
  initialize: async () => {
    const sites = await supabaseDB.sites.get({query: `id, name, password`})
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
    stores.sites.update(sites => [ ...sites, newSite ])
  },
  update: async (id, props) => {
    await supabaseDB.sites.update(id, props)
  },
  save: async (updatedSite, password) => {
    console.log({updatedSite, password})
    stores.sites.update(sites => sites.map(site => site.id === updatedSite.id ? updatedSite : site))

    if (password) {
      const {data:success} = await axios.post(`/api/${updatedSite.id}.json?password=${password}`, updatedSite)
      return success
    } else {
      const homepage = find(updatedSite.pages, ['id', 'index'])
      const preview = await buildStaticPage({ page: homepage, site: updatedSite })
      const [ res1, res2 ] = await Promise.all([
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
      const {data:json} = await axios.get(`/api/${siteID}.json?password=${password}`)
      const data = JSON.parse(json)
      return data ? true : false
    } catch(e) {
      return false
    }
    // return !!data.id
  }
}

export const hosts = {
  initialize: async () => {
    const hosts = await supabaseDB.hosts.get()
    if (hosts) {
      stores.hosts.set(hosts)
    }
  },
  create: async (provider) => {
    stores.hosts.update(hosts => [ ...hosts, provider ])
    await supabaseDB.hosts.create(provider)
  },
  delete: async (name) => {
    stores.hosts.update(hosts => hosts.filter(p => p.name !== name))
    await supabaseDB.hosts.delete(name)
  }
}