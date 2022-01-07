import {writable, get} from 'svelte/store'

const site = {
  name: '',
  data: null,
  deployments: []
}

const store = writable(site);


export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe
}