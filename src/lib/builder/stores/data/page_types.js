import { writable, get } from 'svelte/store'
import { page } from '$app/stores'
import { browser } from '$app/environment'

/** @type {import('svelte/store').Writable<import('$lib').Page_Type[]>} */
const page_types = writable([])

if (browser) {
	page.subscribe(({ data }) => {
		if (data?.page_types) {
			page_types.set(data.page_types)
		}
	})
}

export default page_types
