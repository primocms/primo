import { writable, readable, derived, get } from 'svelte/store';

const store = writable({
  head: {
    raw: '',
    final: ''
  },
  below: {
    raw: '',
    final: ''
  }
})

export default {
  update: store.update,
  set: store.set,
  subscribe: store.subscribe
}
