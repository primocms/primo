import { writable, readable, derived, get } from 'svelte/store';
import {createSite} from '../../const'

let sites = []
const store = writable([])
store.subscribe(s => {
  sites = s
})

export default {
  saveSite: (site) => {
    const updatedSites = sites.map(s => s.id === site.id ? site : s)
    store.set(updatedSites)
  },
  create: () => {
    const newSite = createSite()
    store.update(s => [ ...sites, newSite ])
    return newSite
  },
  set: store.set,
  subscribe: store.subscribe
}