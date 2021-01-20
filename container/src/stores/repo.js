import { writable, readable, derived, get } from 'svelte/store';

const repo = writable(null)

export default repo