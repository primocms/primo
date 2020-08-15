import { writable, readable, derived, get } from 'svelte/store';
import {pageData} from '../@stores/data'

const store = writable({
  headEmbed : '',
  libraries: [],
  // customScripts: [],
})

export default {
  save: (dependencies) => {
    if (dependencies) {
      store.set(dependencies)
    }
  },
  set: (dependencies) => {
    if (dependencies) {
      store.set(dependencies)
    }
  },
  subscribe: store.subscribe
}
