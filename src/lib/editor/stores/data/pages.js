import { writable, get } from 'svelte/store';
import { page } from '$app/stores';

const pages = writable([])

page.subscribe(({data}) => {
  if (data?.pages) {
    pages.set(data.pages)
  }
})

export default pages
