import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const hosts = writable([])

if (browser) {

}

export default hosts