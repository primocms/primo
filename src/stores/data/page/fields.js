import { writable, readable, derived, get } from 'svelte/store';

const store = writable([])

export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe
}
