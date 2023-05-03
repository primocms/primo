import { writable, get } from 'svelte/store';
import { Site } from '../../const'

import {fields,id,name,code} from './draft'

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
      code: get(code),
    })
  },
  get: () => ({
    ...site,
    id: get(id),
    name: get(name),
    fields: get(fields),
    code: get(code),
  }),
  hydrate: (site) => {
    id.set(site.id)
    name.set(site.name)
    fields.set(site.fields)
    code.set(site.code)
  },
  subscribe
}