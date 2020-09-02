import { isEqual } from 'lodash'
import { writable, readable, derived, get } from 'svelte/store';
import { content } from './page'
import { getAllFields, convertFieldsToData, parseHandlebars } from '../../utils'
import { DEFAULTS } from '../../const'

let pageData
const store = writable(DEFAULTS.page)

store.subscribe(s => {
  pageData = s
  // prevent overwriting unsaved content
  if (isEqual(get(content), DEFAULTS.page.content)) {
    content.set(pageData.content)
  }
})

function contentShouldBeUpdated (savedContent, unsavedContent) {
  if (isEqual(unsavedContent, DEFAULTS.page)) {
    return true
  } else return false
}

export default {
  save: (property, value) => {
    store.update(s => ({
      ...s, 
      [property]: value
    }))
  },
  saveStyles: (styles) => {
    store.update(s => ({
      ...s, 
      styles
    }))
  },
  hydrateWrapper: async () => {
    const { head, below } = pageData.wrapper
    const fields = getAllFields()
    const data = await convertFieldsToData(fields, 'all')
    const [ newHead, newBelow ] = await Promise.all([parseHandlebars(head.raw, data),  parseHandlebars(below.raw, data)])

    const newWrapper = {
      ...pageData.wrapper,
      head: {
        ...head,
        final: newHead
      },
      below: {
        ...below,
        final: newBelow
      }
    }

    store.update(s => ({
      ...s,
      wrapper: newWrapper
    }))
  },
  subscribe: store.subscribe,
  set: store.set,
  update: store.update
}