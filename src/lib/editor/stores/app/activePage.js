import {writable,get,derived} from 'svelte/store'
import {Page} from '../../const'

export const id = writable('')
export const url = writable('index')
// export const sections = writable([])
export const code = writable(Page().code)
export const content = writable({ en: {} })
export const fields = writable(Page().fields)

export function set(val) {
  if (val.id) {
    id.set(val.id)
  }
  if (val.url) {
    url.set(val.url)
  }
  if (val.code) {
    code.set(val.code)}
  if (val.content) {
    content.set(val.content)}
  if (val.fields) {
    fields.set(val.fields)
  }
}

// conveniently get the entire site
export default derived(
  [ id, url, code, content, fields ], 
  ([id, url, code, content, fields]) => {
  return {
    id,
    url,
    code, 
    content,
    fields
  }
})
