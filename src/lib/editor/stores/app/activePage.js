import {writable,get,derived} from 'svelte/store'
import {Page} from '../../const'

export const id = writable(0)
export const url = writable('index')
export const sections = writable([])
export const code = writable(Page().code)
export const content = writable({})
export const fields = writable(Page().fields)

export function set(val) {
  if (val.id) {
    id.set(val.id)
  }
  if (val.url) {
    url.set(val.url)
  }
  if (val.sections) {
    sections.set(val.sections)
  }
  if (val.code) {
    code.set(val.code)}
  if (val.fields) {
    fields.set(val.fields)
  }
}

// conveniently get the entire site
export default derived(
  [ id, url, sections, code, fields ], 
  ([id, url, sections, code, fields]) => {
  return {
    id,
    url,
    sections, 
    code, 
    fields
  }
})
