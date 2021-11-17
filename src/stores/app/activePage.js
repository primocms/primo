import {writable,get,derived} from 'svelte/store'
import {DEFAULTS, createPage} from '../../const'


export const id = writable('index')
export const content = writable(DEFAULTS.content)
export const html = writable(DEFAULTS.html)
export const css = writable(DEFAULTS.css)
export const fields = writable(DEFAULTS.fields)


// conveniently get the entire site
export default derived(
  [ content, css, html, fields ], 
  ([content, css, html, fields]) => {
  return {
    // ...createSite(),
    content, 
    css, 
    html, 
    fields
  }
})
