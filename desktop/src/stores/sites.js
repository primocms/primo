import { writable } from 'svelte/store'
import { browser } from '$app/env'
// import { get, set } from 'idb-keyval'
import {find as _find} from 'lodash-es'

const store = writable([])

if (browser) initializSiteData()

async function initializSiteData() {
  const data = window.primo?.data // preload.cjs
  if (!data) return
  const siteFiles = data.load()
  // const sitesDB = await get('sites')
  const sitesDB = []

  const rebuiltSites = siteFiles.map(({data, preview}) => {
    return {
      id: data.id,
      name: data.name,
      activeDeployment: data.activeDeployment,
      data,
      preview
    }
  })

  store.set(rebuiltSites)


}
export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe,
}
