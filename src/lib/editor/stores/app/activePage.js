import {writable,get,derived} from 'svelte/store'
import {Page} from '../../const'

export const id = writable('index')
export const sections = writable([])
export const code = writable(Page().code)
export const fields = writable(Page().fields)

// conveniently get the entire site
export default derived(
  [ id, sections, code, fields ], 
  ([id, sections, code, fields]) => {
  return {
    id,
    sections, 
    code, 
    fields
  }
})
