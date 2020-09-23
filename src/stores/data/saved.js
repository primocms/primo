import { writable, readable, derived, get } from 'svelte/store';
import { createSite } from '../../const'
import fields from './site/fields'
import styles from './site/styles'
import symbols from './site/symbols'
import wrapper from './site/wrapper'

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
      wrapper: get(wrapper)
    })
  },
  get: () => ({
    ...site,
    fields: get(fields),
    styles: get(styles),
    symbols: get(symbols),
    wrapper: get(wrapper)
  }),
  hydrate: (site) => {
    fields.set(site.fields)
    styles.set(site.styles)
    symbols.set(site.symbols)
    wrapper.set(site.wrapper)
  },
  subscribe
}