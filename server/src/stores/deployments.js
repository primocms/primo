import { writable } from 'svelte/store';
import { browser } from '$app/env';
import {get, set} from 'idb-keyval'

const store = writable({})

if (browser) {
  get('deployments').then(res => {
    store.set(res || {})
  })

  store.subscribe((h) => {
    set('deployments', h)
  })
}

export default store