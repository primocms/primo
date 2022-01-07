import { writable } from 'svelte/store'
import { browser } from '$app/env'
import { get, set } from 'idb-keyval'
import _find from 'lodash-es/find.js'

const store = writable([])

if (browser) initializSiteData()

async function initializSiteData() {
  const { data } = window.primo // preload.cjs
  const siteFiles = data.load()
  const sitesDB = await get('sites')

  const rebuiltSites = siteFiles.map((siteFile) => {
    const savedSite = _find(
      sitesDB,
      (savedSite) => savedSite.id === siteFile.id
    )
    return {
      id: siteFile.id,
      name: siteFile.name,
      deployments: savedSite ? savedSite.deployments : [],
      activeDeployment: savedSite ? savedSite.activeDeployment : null,
      data: siteFile,
    }
  })

  store.set(rebuiltSites)

  store.subscribe((s) => {
    const sitesData = s.map((site) => ({
      ...site.data,
    }))
    data.save(sitesData)

    set('sites', s)
  })
}
export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe,
}
