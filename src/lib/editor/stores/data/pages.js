import { writable, get } from 'svelte/store';
import { page } from '$app/stores';
import {browser} from '$app/environment';

const pages = writable([])

if (browser) {
  page.subscribe(({data}) => {
    if (data?.pages) {
      pages.set(data.pages)
    }
  })
}

export default pages
