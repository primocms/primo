import { get, writable, derived } from 'svelte/store';
import { Page, Site } from '../../const'
import {isEqual} from 'lodash-es'

export const id = writable('default')
export const name = writable('')
export const pages = writable([ Page() ])
export const fields = writable([])
export const symbols = writable([])

// export const html = writable(Site().code.html)
// export const css = writable(Site().code.css)
export const code = writable(Site().code)
export const content = writable(Site().content)

// conveniently get the entire site
export const site = derived(
  [ id, name, pages, code, fields, symbols, content ], 
  ([ id, name, pages, code, fields, symbols, content]) => {
  return {
    id, 
    name,
    pages,
    code,
    fields, 
    symbols,
    content
  }
})

export default derived(
  [ id, name, pages, code, fields, symbols, content ], 
  ([ id, name, pages, code, fields, symbols, content]) => {
  return {
    id, 
    name,
    pages,
    code,
    fields, 
    symbols,
    content
  }
})

export const timeline = writable([ get(site) ])
export const undone = writable([])

site.subscribe(s => {
  const items = get(timeline)
  const latestUpdate = items[items.length-1]
  if (!isEqual(s, latestUpdate)) {
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