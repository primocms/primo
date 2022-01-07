import { writable } from 'svelte/store';
import { browser } from '$app/env';

const hosts = writable([])

if (browser) {

}

export default hosts