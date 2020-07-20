import {writable} from 'svelte/store'

export const store = writable({
  id: null,
  focused: false,
  selection: 0,
  position: 0,
  path: {}
}) 

export const focusedNode = {
  subscribe: store.subscribe,
  set: store.set,
  update: store.update,
  setSelection: (options) => {
    store.update(s => ({
      ...s, 
      ...options,
      focused: true,
    }))
  },
  updatePath: (path) => {
    store.update(s => ({...s,path}))
  }
}