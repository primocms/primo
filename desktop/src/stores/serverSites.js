import axios from '$lib/libraries/axios'
import {get, writable} from 'svelte/store'
import { browser } from '$app/environment'
import config from './config'

const store = writable(null);

if (browser) {
  getSitesFromServer()
}

export const connected = writable(false)

export async function getSitesFromServer() {
  const {serverConfig} = get(config)
  try {
    if (!serverConfig.url) return
    const {data:sites, error} = await axios.get(`${serverConfig.url}/api/sites`, {
      headers: {
        Authorization: `Basic ${serverConfig.token}`,
      },
    }).catch(e => {
      console.error(e.message)
      return { data: null }
    })
    if (sites) {
      store.set(sites)
      connected.set(true)
    } else {
      connected.set(false)
    }
  } catch(e) {
    console.warn(e)
  }
}


export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe
}