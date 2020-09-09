import {find} from 'lodash'
import { writable, readable, derived, get } from 'svelte/store';
import ShortUniqueId from 'short-unique-id';
import { tailwindConfig, createSite } from '../../../const'

import domainInfo from '../domainInfo'
import { pageId } from '../page'
import allSites from '../allSites'
import {hydrateComponent,hydrateAllComponents} from '../helpers/components'

let site
const store = writable(createSite())
store.subscribe(s => {
  site = s
  allSites.saveSite(site)
})

export default {
  set: store.set,
  subscribe: store.subscribe, 
  update: store.update,
  fields: {
    save: (fields) => {
      store.update(s => ({
        ...s,
        fields 
      }))
    }
  },
  getPage: (pageId) => find(site.pages, ['id', pageId]),
  saveCurrentPage: (newData) => {
    store.update(s => ({
      ...s,
      pages: s.pages.map(p => p.id === get(pageId) ? ({
        ...p,
        ...newData
      }) : p)
    }))
  },
  pages: {
    add: (page) => {
      store.update(s => ({
        ...s, 
        pages: [ ...s.pages, page ]
      }))
    },
    remove: (pageId) => {
      store.update(s => ({
        ...s,
        pages: s.pages.filter(page => page.id !== pageId)
      }))
    },
    modify: (page) => {
      store.update(s => ({
        ...s,
        pages: s.pages.map(p => p.id === page.id ? page : p)
      }))
    },
    hydrateComponents: async () => {
      const updatedPages = await Promise.all(site.pages.map(async page => {
        const updatedContent = await hydrateAllComponents(page.content)
        return {
          ...page,
          content: updatedContent
        }
      }))
      store.update(s => ({
        ...s, 
        pages: updatedPages
      }))
    }
  },
  save: (data = {}) => {
    store.update(s => ({ ...s, ...data }))
    // saveToSite(data)
  },
};


// REDUCERS
async function saveSiteData(data) {
  store.update(s => ({ ...s, data }))
}

async function hydrateSitePagesContent(exclude = null) {
  const updatedPages = await hydrateSiteComponents(exclude)
  // await saveAllPages(updatedPages) // TODO
}

async function hydrateComponentLibrary() {
  // const components = await getComponents() // TODO
  const hydratedComponents = await Promise.all( components.map(async component => await hydrateComponent(component)) )
  // await Promise.all([ hydratedComponents.map(async component => saveSymbolToDomain(component)) ]) TODO
}


// HELPERS
async function hydrateSiteComponents(exclude = null) {
  // // const pages = await getAllPages() // TODO
  // const pages = get(store).pages
  // const updatedPages = await Promise.all(pages.filter(page => page.settings.identity.url !== exclude).map(async page => ({
  //   ...page,
  //   content: await hydrateAllComponents(page.content)
  // })))
  // return updatedPages
}

function getUniqueId() {
  return new ShortUniqueId().randomUUID(5).toLowerCase();
}