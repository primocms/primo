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
  const { config } = window.primo
  store.set({
    saveDir: window.primo.config.getSavedDirectory(),
    hosts: window.primo.config.getHosts(),
    serverConfig: window.primo.config.getServerConfig(),
    telemetryEnabled: window.primo.config.getTelemetry(),
    machineID: window.primo.config.getMachineID(),
  })
  store.subscribe((c) => {
    config.setHosts(c.hosts)
    config.setServerConfig(c.serverConfig)
    config.setTelemetry(c.telemetryEnabled)
  })
}

export default store