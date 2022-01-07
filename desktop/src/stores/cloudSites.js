import axios from 'axios'
import {get, writable} from 'svelte/store'
import { browser } from '$app/env'
import config from '../stores/config'

const store = writable(null);

if (browser) {
  getSitesFromServer()
}

export const connected = writable(false)

async function getSitesFromServer() {
  const {serverConfig} = get(config)
  try {
    const res = await axios.get(`${serverConfig.url}/api/sites.json`, {
      headers: {
        Authorization: `Basic ${serverConfig.token}`,
      },
    })
    const {sites} = res.data
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