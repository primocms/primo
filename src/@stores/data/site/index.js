import symbols from './symbols'

import { writable, readable, derived, get } from 'svelte/store';
import { tailwindConfig } from '../../../const'
import {hydrateAllComponents,hydrateComponent,getUniqueId} from '../../../utils'

import {domainInfo,pageData} from '../index'
import {content} from '../page'

let site
const store = writable({
  pages: [
    {
      id: getUniqueId(),
      title: 'New Page',
      content: [
        {
          id: getUniqueId(),
          width: 'contained',
          columns: [
            {
              id: getUniqueId(),
              size: 'w-full',
              rows: [
                {
                  id: getUniqueId(),
                  type: 'content',
                  value: {
                    html: '<p><br></p>'
                  }
                }
              ]
            }
          ]
        }
      ],
      styles: {
        raw: '',
        final: '',
        tailwind: '{  theme: {    container: {      center: true    }  },  variants: {}}'
      },
      dependencies: {
        headEmbed : '',
        libraries: [],
        // customScripts: [],
      },
      settings: {
        javascript: '',
        identity : {
          title: '', 
          url: '',
          description: ''
        }
      },
      wrapper: {
        raw: {
          head: '',
          above: '',
          below: ''
        },
        final: {
          head: '',
          above: '',
          below: ''
        }
      },
      fields: []
    },
  ],
  fields: [],
  styles: {
    raw: '',
    final: '',
    tailwind: tailwindConfig
  },
  wrapper: {
    head: {
      raw: '',
      final: ''
    },
    below: {
      raw: '',
      final: ''
    }
  },
  symbols: [],
})
store.subscribe(s => {
  site = s
  if (s && symbols) {
    symbols.set(s.symbols)
  }
})

export {
  symbols
}

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
  saveNav: async (navItems) => {
    const { pageId } = get(domainInfo)
    await saveSiteData({ navItems })
    await Promise.all([ hydrateComponentLibrary(), hydratePageContent(), hydrateSitePagesContent(pageId)])
  },
  saveStyles: async (styles) => {
    store.update(s => ({ ...s, styles }))
  },
  savePageSettings: (settings) => {
    const { pageId } = get(domainInfo)
    store.update(s => ({ 
      ...s,  
      pages: s.pages.map(page => page.id === pageId ? ({
          ...page,
          settings
      }) : page)
    }))
  },
  save: (data = {}) => {
    store.update(s => ({ ...s, ...data }))
    // saveToSite(data)
  },
  saveContent: (content) => {
    const { page:pageId } = get(domainInfo)
    store.update(s => ({ 
      ...s,  
      pages: s.pages.map(page => page.id === pageId ? ({
          ...page,
          content
      }) : page)
    }))
  }
};


// REDUCERS
async function saveSiteData(data) {
  store.update(s => ({ ...s, data }))
}

async function hydratePageContent() {
  const updatedContent = await hydrateAllComponents(get(content))
  content.set(updatedContent)
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