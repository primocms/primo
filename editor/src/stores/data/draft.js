import { get, writable, derived } from 'svelte/store';
import { Page, Site } from '../../const'
import { createStack } from 'svelte-undo';

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

export let timeline = createStack(get(site));
export function resetTimeline(site) {
  timeline = createStack(site)
}


site.subscribe(s => {
  const stack = get(timeline)
  if (stack.last) {
    timeline.push(s)
  }
})