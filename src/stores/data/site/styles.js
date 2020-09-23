import { writable, readable, derived, get } from 'svelte/store';

const store = writable({
  raw: '',
  final: '',
  tailwind: ''
})

export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe
}
