import { writable, get } from 'svelte/store';
import { page } from '$app/stores';
import {browser} from '$app/environment';

/** @type {import('svelte/store').Writable<import('$lib').Page[]>} */
const pages = writable([])

if (browser) {
  page.subscribe(({data}) => {
    if (data?.pages) {
      pages.set(data.pages)
    }
  })
}

export default pages
