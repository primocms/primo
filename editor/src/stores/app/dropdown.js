import {writable} from 'svelte/store'

const dropdown = writable([])

export default {
  register: (buttons) => {
    dropdown.update(s => [
      ...s,
      ...buttons
    ])
  },
  set: dropdown.set,
  subscribe: dropdown.subscribe
}