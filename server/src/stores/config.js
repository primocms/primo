import { writable } from 'svelte/store';

const store = writable({
  // saveDir: window.primo.config.getSavedDirectory(),
  // hosts: window.primo.config.getHosts()
  saveDir: '',
  hosts: ''
})

store.subscribe((c) => {
  // config.setHosts(c.hosts)
})

export default store