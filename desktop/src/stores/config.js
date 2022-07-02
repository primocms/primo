import { writable } from 'svelte/store';
import { browser } from '$app/env'


const store = writable({
  saveDir: '',
  hosts: [],
  serverConfig: {
    url: '',
    token: ''
  },
  telemetryEnabled: false,
  machineID: null
})

if (browser) {
  const config = window.primo?.config
  if (config) {
    store.set({
      saveDir: config.getSavedDirectory(),
      hosts: config.getHosts(),
      serverConfig: config.getServerConfig(),
      telemetryEnabled: config.getTelemetry(),
      machineID: config.getMachineID(),
    })
    store.subscribe((c) => {
      config.setHosts(c.hosts)
      config.setServerConfig(c.serverConfig)
      config.setTelemetry(c.telemetryEnabled)
    })
  }
}

export default store