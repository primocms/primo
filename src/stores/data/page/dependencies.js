import { writable, readable, derived, get } from 'svelte/store';
import pageData from '../pageData'

const store = writable({
  headEmbed : '',
  libraries: [],
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
