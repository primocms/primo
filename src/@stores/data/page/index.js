import _ from 'lodash'
import { writable, get } from 'svelte/store';

import dependencies from './dependencies'
import content from './content'

import {pageData} from '../index'
import site from '../site'

export const pageId = writable(null)

pageId.subscribe(id => {
  const currentPage = _.find(get(site).pages, ['id', id || 'index'])
  if (currentPage && pageData) {
    pageData.update(p => ({
      ...p,
      ...currentPage
    }))
    content.set(currentPage.content)
  }
})

export {
  dependencies,
  content
}
