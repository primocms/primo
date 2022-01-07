import {get, writable} from 'svelte/store'
import { browser } from '$app/env'
import user from '.././stores/user'

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