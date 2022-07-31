import { get } from 'svelte/store'
import { find as _find } from 'lodash-es'
import axios from '$lib/libraries/axios'
import config from '../stores/config'
import * as stores from '../stores'
import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'

export const serverSites = {
  save: async (site) => {
    const { serverConfig } = get(config)
    let successful = false
    try {
      const res = await axios.post(
        `${serverConfig.url}/api/${site.id}.json`,
        {
          action: 'SAVE_SITE',
          payload: site
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
}

let siteBeingEdited = null
export async function setActiveEditor(siteID) {
  if (siteBeingEdited === siteID) return
  siteBeingEdited = siteID
  const { serverConfig } = get(config)
  const res = await axios.post(
    `${serverConfig.url}/api/${siteID}.json`,
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

export async function addDeploymentToSite({
  siteID,
  deployment,
  activeDeployment,
}) {
  stores.sites.update((s) =>
    s.map((site) => {
      return site.id === siteID
        ? {
          ...site,
          // deployments: [deployment, ...site.deployments],
          activeDeployment,
        }
        : site
    })
  )
}

export const hosts = {
  connect: async ({ name, token }) => {
    const endpoint = {
      vercel: 'https://api.vercel.com/www/user',
      netlify: 'https://api.netlify.com/api/v1/user',
    }[name]

    const { data } = await axios
      .get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .catch((e) => {
        data: null
      })
    if (data) {
      stores.hosts.update((h) => {
        return [
          ...h,
          {
            name,
            token,
            // user: data.user,
          },
        ]
      })
    } else {
      window.alert('Could not connect to host')
    }
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