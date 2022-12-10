import { get } from 'svelte/store'
import { find as _find } from 'lodash-es'
import axios from '$lib/libraries/axios'
import config from '../stores/config'
import * as stores from '../stores'
import { buildStaticPage } from '@primo-app/primo/stores/helpers'
import { locale, addMessages } from 'svelte-i18n'

export const serverSites = {
  save: async (site) => {
    const { serverConfig } = get(config)

    let successful = false
    try {
      // generate preview
      const homepage = _find(site.pages, ['id', 'index'])
      const preview = await buildStaticPage({
        page: homepage,
        site,
        separateModules: false
      })

      const res = await axios.post(
        `${serverConfig.url}/api/${site.id}`,
        {
          action: 'SAVE_SITE',
          payload: { site, preview }
        },
        {
          headers: {
            Authorization: `Basic ${serverConfig.token}`,
          },
        }
      )
      if (res.data) {
        successful = true
      }
    } catch (e) {
      console.warn(e)
    }
    return successful
  },
  publish: async (site) => {
    const { serverConfig } = get(config)
    const res = await axios.post(
      `${serverConfig.url}/api/${site.id}`,
      {
        action: 'PUBLISH_SITE',
        payload: site
      },
      {
        headers: {
          Authorization: `Basic ${serverConfig.token}`,
        },
      }
    )
  },
}

let siteBeingEdited = null
export async function setActiveEditor(siteID) {
  if (siteBeingEdited === siteID) return
  siteBeingEdited = siteID
  const { serverConfig } = get(config)
  const res = await axios.post(
    `${serverConfig.url}/api/${siteID}`,
    {
      action: 'SET_ACTIVE_EDITOR',
      payload: {
        siteID,
        userID: 'a Primo Desktop user'
      }
    },
    {
      headers: {
        Authorization: `Basic ${serverConfig.token}`,
      },
    }
  )
  if (siteBeingEdited === siteID) {
    siteBeingEdited = null
    setActiveEditor(siteID)
  }
}

export async function setLanguage(language) {
  config.update(c => ({
    ...c,
    language
  }))
  const m = await import(`../languages/${language}.json`)
  addMessages(language, m.default)
  locale.set(language)
}

export async function storeSite(site) {
  window.primo.data.save(site)
}

export async function setSitePreview(site) {
  const homepage = _find(site.pages, ['id', 'index'])
  const preview = await buildStaticPage({
    page: homepage,
    site,
    separateModules: false
  })
  const siteID = site.id
  stores.sites.update((s) =>
    s.map((site) => site.id === siteID ? ({
      ...site,
      preview
    }) : site)
  )
  window.primo?.data.setPreview({ id: site.id, preview })
}

export async function addDeploymentToSite({ siteID, deployment }) {
  const [local_site] = (get(stores.sites)).filter(site => site.id === siteID)
  if (local_site) {
    stores.sites.update((s) =>
      s.map((site) => {
        return site.id === siteID
          ? {
            ...site,
            activeDeployment: deployment,
          }
          : site
      })
    )
    window.primo?.data.setDeployment({ id: siteID, deployment })
  } else { // is server site

  }
}

export const hosts = {
  // todo: enable adding multiple hosts, connecting site to each
  connect: async ({ name, token }) => {
    stores.hosts.update((h) => {
      return [{
        name,
        token,
      }]
    })
  },
  delete: (name) => {
    stores.hosts.update((hosts) => hosts.filter((p) => p.name !== name))
  },
}

const EVENTS = [
  'CREATE_SITE',
  'OPEN_SITE',
  'ADD_PRIMO_COMPONENT',
  'ADD_COMMUNITY_COMPONENT',
  'CREATE_COMPONENT',
  'ADD_TO_PAGE',
  'CREATE_PAGE',
  'ADD_LOCALITY',
  'PUBLISH_SITE',
  'DOWNLOAD_SITE',
  'UPDATE_APP'
]
const machineID = get(config).machineID
export async function track(event, args = null) {
  if (!EVENTS.includes(event)) console.warn('Event does not exist', event)
  if (get(config).telemetryEnabled) {
    // await axios.post('https://api.primo.af/telemetry.json', {event, machine_id: machineID, args})
  } else {
    console.log('Telemetry disabled', event)
  }
}