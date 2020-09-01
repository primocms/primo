import { writable, derived, get } from 'svelte/store';
import _ from 'lodash'
import {wrapInStyleTags,processStyles,ax} from '../../utils'
import storeLib from '../../@libraries/store.js'

import {site,pageData} from './index'

const store = writable(storeLib.get('tailwind'))

export const loadingTailwind = writable(false)

export default {
  subscribe: store.subscribe,
  setInitial: async () => {
    const tw = storeLib.get('tailwind')
    if (typeof tw === 'string') {
      store.set(tw)
    } else if (!tw)  {
      await hydrateTailwind()
    }
  },
  reload: async () => {
    await hydrateTailwind()
  },
  swapInConfig: _.debounce(async (tempConfig, callback) => {
    const tw = await getTailwind(tempConfig)
    callback()
    setLocalStorage(tw)
  }, 1000),
  swapOutConfig: () => {
    setLocalStorage(get(store))
  },
  saveSwappedInConfig: () => {
    const tw = storeLib.get('tailwind')
    store.set(tw)
  },
  getCombinedConfig: (pageTailwindConfig) => {
    let siteTailwindObject = {}
    let pageTailwindObject = {}
    try {
      siteTailwindObject = new Function(`return ${get(site).styles.tailwind}`)() // convert string object to literal object
      pageTailwindObject = new Function(`return ${pageTailwindConfig}`)()
      return _.merge(siteTailwindObject, pageTailwindObject)
    } catch(e) {
      console.error(e)
      return {}
    }
  }
}

let tailwindRetrievalAttempts = 0
async function hydrateTailwind() {
  loadingTailwind.set(true)
  const config = getCombinedTailwindConfig(get(pageData).styles.tailwind)
  
  // This is my hacky attempt (works tho) to disregard invalid tailwind styles
  // when hydrateTailwind() gets called repeatedly (as it does when the app loads)
  tailwindRetrievalAttempts++
  const currentAttempt = tailwindRetrievalAttempts
  const tw = await getTailwind(config)
  if (currentAttempt === tailwindRetrievalAttempts) {
    loadingTailwind.set(false)
    store.set(tw)
    setLocalStorage(tw)
  } 
}

async function getTailwind(tailwindConfig) {
  const tw = await processStyles('','',{
    tailwindConfig: JSON.stringify(tailwindConfig), 
    includeBase: true,
    includeTailwind: true,
    purge: false
  })
  return tw
}

function setLocalStorage(tw) {
  if (tw) {
    storeLib.set('tailwind', tw)  
  }
}


// HELPERS
export function getCombinedTailwindConfig(pageTailwindConfig) {
  let siteTailwindObject
  let pageTailwindObject
  try {
    const siteTW = get(site).styles.tailwind
    siteTailwindObject = new Function(`return ${siteTW}`)() // convert string object to literal object
    pageTailwindObject = new Function(`return ${pageTailwindConfig}`)()
    return _.merge(siteTailwindObject, pageTailwindObject)
  } catch(e) {
    console.error(e)
    return {}
  }
}