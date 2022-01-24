import { writable, get } from 'svelte/store';
import { Site } from '../../const'

import {fields,symbols,pages,id,name,code} from './draft'

let site
const {subscribe,set} = writable(Site())
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
      code: get(code),
      pages: get(pages)
    })
  },
  get: () => ({
    ...site,
    id: get(id),
    name: get(name),
    fields: get(fields),
    code: get(code),
    symbols: get(symbols),
    pages: get(pages)
  }),
  hydrate: (site) => {
    id.set(site.id)
    name.set(site.name)
    fields.set(site.fields)
    code.set(code)
    symbols.set(site.symbols)
    pages.set(site.pages)
  },
  subscribe
}