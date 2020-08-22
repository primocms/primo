import { writable, readable, derived, get } from 'svelte/store';

const store = writable([])

export default {
  set: store.set,
  subscribe: store.subscribe
}