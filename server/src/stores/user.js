import { writable, readable, derived, get } from 'svelte/store';
import { User } from '$lib/constructs'

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

const { set, subscribe } = writable('developer')
export const role = {
  set: (newRole) => {
    if (newRole === 'developer' || newRole === 'editor') {
      set(newRole)
    } 
  },
  subscribe
}