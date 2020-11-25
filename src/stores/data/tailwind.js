import {getContext} from 'svelte'
import { writable, derived, get } from 'svelte/store';
import _ from 'lodash'
import { set, get as getIDB } from 'idb-keyval';
import axios from 'axios'
import {processors} from '../../component'

import { styles as siteStyles } from './draft'
import {styles as pageStyles} from '../app/activePage'

const store = writable('')
getIDB('tailwind').then(t => {
  store.set(t)
})

export const loadingTailwind = writable(false)

export default {
  subscribe: store.subscribe,
  setInitial: async () => {
    const tw = await getIDB('tailwind')
    if (typeof tw === 'string') {
      store.set(tw)
    } 

    await hydrateTailwind()
  },
  reload: async () => {
    await hydrateTailwind()
  },
  swapInConfig: _.debounce(async (tempConfig, callback) => {
    const tw = await getTailwindStyles(tempConfig)
    callback()
    setLocalStorage(tw)
  }, 1000),
  swapOutConfig: () => {
    setLocalStorage(get(store))
  },
  saveSwappedInConfig: async () => {
    const tw = await getIDB('tailwind')
    store.set(tw)
  }
}

async function hydrateTailwind() {
  loadingTailwind.set(true)
  const config = getCombinedTailwindConfig(get(pageStyles).tailwind, get(siteStyles).tailwind)
  const tw = await getTailwindStyles(config)
  loadingTailwind.set(false)
  store.set(tw)
  setLocalStorage(tw)
}

async function getTailwindStyles(tailwind) {
  const tw = await processors.css(`
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  `,{
    tailwind
  })
  return tw
}

function setLocalStorage(tw) {
  if (tw) {
    set('tailwind', tw);
  }
}


// HELPERS
export function getCombinedTailwindConfig(pageTW, siteTW) {
  let siteTailwindObject
  let pageTailwindObject
  try {
    siteTailwindObject = new Function(`const require = (id) => id; return ${siteTW}`)() // convert string object to literal object
    pageTailwindObject = new Function(`const require = (id) => id; return ${pageTW}`)()
    const combined = _.merge(siteTailwindObject, pageTailwindObject)
    const asString = JSON.stringify(combined)
    const withPlugins = asString.replace(`"@tailwindcss/ui"`,`require('@tailwindcss/ui')`)
    return withPlugins
  } catch(e) {
    console.error(e)
    return {}
  }
}