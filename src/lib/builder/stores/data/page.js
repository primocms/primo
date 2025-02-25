import { writable, get } from 'svelte/store';
import { Page } from '../../factories.js'

/** @type {import('svelte/store').Writable<import('$lib').Page>} */
export default writable(Page())