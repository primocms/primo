leaimport { writable } from 'svelte/store'
import { browser } from '$app/env'
// import { get, set } from 'idb-keyval'
import {find as _find} from 'lodash-es'

const store = writable([])

if (browser) initializSiteData()

async function initializSiteData() {
  const { data } = window.primo // preload.cjs
  const siteFiles = data.load()
  // const sitesDB = await get('sites')
  const sitesDB = []

  const rebuiltSites = siteFiles.map(({data, preview}) => {
    const savedSite = _find(
      sitesDB,
      (savedSite) => savedSite.id === data.id
    )
    return {
      id: data.id,
      name: data.name,
      deployments: savedSite ? savedSite.deployments : [],
      activeDeployment: savedSite ? savedSite.activeDeployment : null,
      data,
      preview
    }
  })

  store.set(rebuiltSites)

  store.subscribe((s) => {
    const sitesData = s.map((site) => ({
      ...site.data,
    }))
    data.save(sitesData)

    // set('sites', s)
  })
}
export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe,
}
