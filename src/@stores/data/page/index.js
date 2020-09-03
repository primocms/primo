import _ from 'lodash'
import { writable, get } from 'svelte/store';

import dependencies from './dependencies'
import content from './content'

import {pageData} from '../index'
import site from '../site'

export const pageId = writable(null)

pageId.subscribe(id => {
  const newPage = _.find(get(site).pages, ['id', id || 'index'])
  if (newPage && pageData) {
    pageData.update(p => ({
      ...p,
      ...newPage
    }))
    content.set(newPage.content)
  }
})

export {
  dependencies,
  content
}
