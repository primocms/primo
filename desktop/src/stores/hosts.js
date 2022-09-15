import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import {get, set} from 'idb-keyval'

const hosts = writable([])

if (browser) {
  get('hosts').then(res => {
    hosts.set(res || [])
  })

  hosts.subscribe((h) => {
    set('hosts', h)
  })
}

export default hosts