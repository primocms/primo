import { writable, readable, derived, get } from 'svelte/store';

const store = writable({
  isSubdomain: false,
  domainName: '',
  onDev: false,
  page: ''
})

export default {
  save: (prop = {}) => {
    if (prop && Object.keys(prop).length > 0) {
      store.update(s => ({...s, ...prop}))
    }
  },
  subscribe: store.subscribe
}
