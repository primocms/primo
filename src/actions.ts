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
import { page } from '$app/stores'

export const sites = {
  create: async ({ data, preview }) => {
    const { pages, symbols, sections } = data
    const site = {
      id: data.id,
      url: data.url,
      name: data.name,
      code: data.code,
      content: data.content,
      fields: data.fields,
      owner: get(page).data.user.id
    }

    await supabaseDB.sites.create(site)
    await Promise.all([
      ...symbols.map(symbol => supabase.from('symbols').insert(symbol)),
      ...pages.map(page => supabase.from('pages').insert(page))
    ])
    await Promise.all(sections.map(section => supabase.from('sections').insert(section)))

    await supabase.from('pages').update({ preview }).match({ url: 'index', site: site.id })
  },
  update: async ({ id, props }) => {
    stores.sites.update(
      sites => sites.map(
        s => s.id !== id
          ? s
          : ({ ...s, ...props })
      )
    )
    await supabase.from('sites').update(props).eq('id', id)
  },
  delete: async (id) => {
    stores.sites.update(sites => sites.filter(s => s.id !== id))

    const { data: sections_to_delete } = await supabase.from('sections').select('id, page!inner(*)').filter('page.site', 'eq', id)
    await Promise.all(
      sections_to_delete.map(async section => {
        await supabase.from('sections').delete().eq('id', section.id)
      })
    )
    await Promise.all([
      supabase.from('pages').delete().match({ site: id }),
      supabase.from('symbols').delete().match({ site: id }),
      supabase.from('invitations').delete().match({ site: id }),
      supabase.from('collaborators').delete().match({ site: id }),
    ])
    await supabase.from('sites').delete().eq('id', id)
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
  create: async (provider) => {
    stores.hosts.update(hosts => [...hosts, provider])
    await supabaseDB.hosts.create(provider)
  },
  delete: async (name) => {
    stores.hosts.update(hosts => hosts.filter(p => p.name !== name))
    await supabaseDB.hosts.delete(name)
  }
}

export const github_token = {
  set: async (token) => {
    stores.config.update(config => ({
      ...config,
      github_token: token
    }))
    await supabase.from('config').update({ value: token }).eq('id', 'github-token')
  },
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