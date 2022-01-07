import { writable } from 'svelte/store';
import { browser } from '$app/env'


const store = writable({
  saveDir: '',
  hosts: [],
  serverConfig: {
    url: '',
    token: ''
  },
})

if (browser) {
  const { config } = window.primo
  store.set({
    saveDir: window.primo.config.getSavedDirectory(),
    hosts: window.primo.config.getHosts(),
    serverConfig: window.primo.config.getServerConfig(),
  })
  store.subscribe((c) => {
    config.setHosts(c.hosts)
    config.setServerConfig(c.serverConfig)
  })
}

export default store