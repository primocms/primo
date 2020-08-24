import { writable, readable, derived, get } from 'svelte/store';
import { site } from './index'
import {content} from './page'
import { getAllFields, convertFieldsToData, parseHandlebars } from '../../utils'

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
    head: {
      raw: '',
      final: ''
    },
    below: {
      raw: '',
      final: ''
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
    content.set(s.content) 
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