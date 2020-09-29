import { writable, readable, derived } from 'svelte/store';
import { createSite, createPage, DEFAULTS } from '../../const'

export const pages = writable([ createPage() ])
export const dependencies = writable(DEFAULTS.dependencies)
export const styles = writable(DEFAULTS.styles)
export const wrapper = writable(DEFAULTS.wrapper)
export const fields = writable([])
export const symbols = writable([])

// conveniently get the entire site
export const site = derived(
  [ pages, dependencies, styles, wrapper, fields, symbols ], 
  (res) => {
  const [pages, dependencies, styles, wrapper, fields, symbols] = res
  return {
    ...createSite(),
    pages,
    dependencies, 
    styles, 
    wrapper, 
    fields, 
    symbols
  }
})