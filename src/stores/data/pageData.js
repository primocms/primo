import { isEqual } from 'lodash'
import { writable, readable, derived, get } from 'svelte/store';
import { getAllFields } from '../../utils'
import { convertFieldsToData, parseHandlebars } from './helpers/components'
import { createPage } from '../../const'

let pageData
const store = writable(createPage())

store.subscribe(s => {
  pageData = s
  // prevent overwriting unsaved content
  // if (isEqual(get(content), DEFAULTS.page.content)) {
  //   content.set(pageData.content)
  // }
  // content.set(s.content)
})

export default {
  save: (property, value) => {
    store.update(s => ({
      ...s, 
      content: get(content), // prevent overwriting unsaved content
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