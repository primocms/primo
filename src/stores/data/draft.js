import { get, writable, readable, derived } from 'svelte/store';
import { createSite, createPage, DEFAULTS } from '../../const'
import _ from 'lodash'

export const pages = writable([ createPage() ])
export const dependencies = writable(DEFAULTS.dependencies)
export const styles = writable(DEFAULTS.styles)
export const wrapper = writable(DEFAULTS.wrapper)
export const fields = writable([])
export const symbols = writable([])

// conveniently get the entire site
export const site = derived(
  [ pages, dependencies, styles, wrapper, fields, symbols ], 
  ([pages, dependencies, styles, wrapper, fields, symbols]) => {
  return {
    // ...createSite(),
    pages,
    dependencies, 
    styles, 
    wrapper, 
    fields, 
    symbols
  }
})

export const timeline = writable([ get(site) ])
export const undone = writable([])

site.subscribe(s => {
  const items = get(timeline)
  const latestUpdate = items[items.length-1]
  if (!_.isEqual(s, latestUpdate)) {
    timeline.update(t => ([ ...t, s ]))
  } 
})

let length = 0

timeline.subscribe(t => {
  if (t.length > length) { // timeline has grown (new change, not undo)
    undone.set([])
  } 
  length = t.length
})
