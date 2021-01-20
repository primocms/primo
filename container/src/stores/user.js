import { writable, readable, derived, get } from 'svelte/store';
import { User } from '../constructs'

const store = writable(User())

export default {
  subscribe: store.subscribe, 
  update: store.update,
  set: (details) => {
    if (typeof details !== 'object') console.error('User store arguments must be object, received:', details)
    else {
      return store.update((user) => (
        User({
          ...user,
          ...details
        })
      ))
    }
  },
  reset: () => {
    store.set(User())
  }
}