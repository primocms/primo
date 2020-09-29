import { writable, readable, derived, get } from 'svelte/store';
import { createSite } from '../../const'

import {fields,styles,symbols,wrapper,pages} from './draft'

let site
const {subscribe,set} = writable(createSite())
subscribe(s => {
  site = s
})

export default {
  save: () => {
    set({
      ...site,
      fields: get(fields),
      styles: get(styles),
      symbols: get(symbols),
      wrapper: get(wrapper),
      pages: get(pages)
    })
  },
  get: () => ({
    ...site,
    fields: get(fields),
    styles: get(styles),
    symbols: get(symbols),
    wrapper: get(wrapper),
    pages: get(pages)
  }),
  hydrate: (site) => {
    fields.set(site.fields)
    styles.set(site.styles)
    symbols.set(site.symbols)
    wrapper.set(site.wrapper)
    pages.set(site.pages)
  },
  subscribe
}