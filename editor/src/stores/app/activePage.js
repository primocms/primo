import {writable,get,derived} from 'svelte/store'
import {Page} from '../../const'

export const id = writable('index')
export const sections = writable([])
export const code = writable(Page().code)
// export const html = writable(Page().code.html)
// export const css = writable(Page().code.css)
export const fields = writable(Page().fields)

// conveniently get the entire site
export default derived(
  [ sections, code, fields ], 
  ([sections, code, fields]) => {
  return {
    sections, 
    code, 
    fields
  }
})
