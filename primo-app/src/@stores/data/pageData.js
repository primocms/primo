import { writable, readable, derived, get } from 'svelte/store';
import { site } from '../@stores/data'
import {content} from './page'
import { getAllFields, convertFieldsToData, parseHandlebars } from '../utils'

let pageData
const store = writable({
  id: '',
  title: '',
  content: [],
  dependencies: {
    headEmbed: '',
    libraries: []
  },
  styles: {
    raw: '',
    final: '',
    tailwind: ''
  },
  wrapper: {
    raw: {
      head: '',
      above: '',
      below: ''
    },
    final: {
      head: '',
      above: '',
      below: ''
    }
  },
  fields: []
})

store.subscribe(s => {
  pageData = s
  if (s && site) {
    site.pages.modify(s)
  }
  if (s && content) {
    // content.set(s.content) // don't overwrite unsaved content
  }
})

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
    const { head, above, below } = pageData.wrapper.raw
    const fields = getAllFields()
    const data = await convertFieldsToData(fields, 'all')
    const [ newHead, newAbove, newBelow ] = await Promise.all([parseHandlebars(head, data), parseHandlebars(above, data), parseHandlebars(below, data)])

    const newWrapper = {
      ...pageData.wrapper,
      final: {
        head: newHead,
        above: newAbove,
        below: newBelow
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