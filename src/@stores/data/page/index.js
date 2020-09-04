import _ from 'lodash'
import { writable, get } from 'svelte/store';

import pageData from '../pageData'
import site from '../site'

export const pageId = writable(null)

pageId.subscribe(id => {
  if (site) {
    const newPage = _.find(get(site).pages, ['id', id || 'index'])
    if (newPage && pageData) {
      pageData.update(p => ({
        ...p,
        ...newPage
      }))
    }
  }
})

