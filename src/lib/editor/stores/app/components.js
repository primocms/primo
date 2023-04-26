import {writable} from 'svelte/store'

const components = writable({})

export default {
  set: components.set,
  subscribe: components.subscribe,
  update: components.update
}