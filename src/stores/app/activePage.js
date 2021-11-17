import {writable,get,derived} from 'svelte/store'
import {DEFAULTS, createPage} from '../../const'


export const id = writable('index')
export const sections = writable(DEFAULTS.page.sections)
export const html = writable(DEFAULTS.html)
export const css = writable(DEFAULTS.css)
export const fields = writable(DEFAULTS.fields)



// conveniently get the entire site
export default derived(
  [ sections, css, html, fields ], 
  ([sections, css, html, fields]) => {
  return {
    // ...createSite(),
    sections, 
    css, 
    html, 
    fields
  }
})
