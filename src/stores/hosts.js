import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const hosts = writable([])

export default hosts