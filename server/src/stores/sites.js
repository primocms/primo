import {writable} from 'svelte/store'

const site = {
  id: '',
  data: {},
  deployments: []
}

const store = writable([]);

export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe
}