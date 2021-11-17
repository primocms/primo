import { writable, get } from 'svelte/store';
import { createSite } from '../../const'

import {fields,symbols,pages,id,name,html,css} from './draft'

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
      symbols: get(symbols),
      html: get(html),
      css: get(css),
      pages: get(pages)
    })
  },
  get: () => ({
    ...site,
    id: get(id),
    name: get(name),
    fields: get(fields),
    css: get(css),
    symbols: get(symbols),
    html: get(html),
    pages: get(pages)
  }),
  hydrate: (site) => {
    id.set(site.id)
    name.set(site.name)
    fields.set(site.fields)
    css.set(site.css)
    symbols.set(site.symbols)
    html.set(site.html)
    pages.set(site.pages)
  },
  subscribe
}