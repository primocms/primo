import {getContext} from 'svelte'
import { writable, derived, get } from 'svelte/store';

const store = writable([])

export default {
  set: store.set,
  subscribe: store.subscribe,
}
