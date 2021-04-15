import { writable, readable, derived, get } from 'svelte/store';
import { createSite } from '../../const'

import {fields,styles,symbols,wrapper,pages,id,name} from './draft'

let site
const {subscribe,set} = writable(createSite())
subscribe(s => {
  site = s
})

export default {
  save: () => {
    set({
      ...site,
      id: get(id),
      name: get(name),
      fields: get(fields),
      styles: get(styles),
      symbols: get(symbols),
      wrapper: get(wrapper),
      pages: get(pages)
    })
  },
  get: () => ({
    ...site,
    id: get(id),
    name: get(name),
    fields: get(fields),
    styles: get(styles),
    symbols: get(symbols),
    wrapper: get(wrapper),
    pages: get(pages)
  }),
  hydrate: (site) => {
    id.set(site.id)
    name.set(site.name)
    fields.set(site.fields)
    styles.set(site.styles)
    symbols.set(site.symbols)
    wrapper.set(site.wrapper)
    pages.set(site.pages)
  },
  subscribe
}