import _ from 'lodash'
import { get } from 'svelte/store'
import { getSymbol } from './helpers'
import { createUniqueID } from '../utilities'
import { id, content } from './app/activePage'
import { unsaved } from './app/misc'
import { focusedNode } from './app/editor'
import { styles, wrapper, fields } from './data/draft'
import * as stores from './data/draft'
import { timeline, undone } from './data/draft'
import { processors } from '../component'
import { updateHtmlWithFieldData } from '../utils'

export async function hydrateSite(data) {
  content.set([])
  stores.id.set(data.id)
  stores.name.set(data.name)
  stores.pages.set(data.pages)
  styles.set(data.styles)
  wrapper.set(data.wrapper)
  fields.set(data.fields)
  stores.symbols.set(data.symbols)
}

export async function updateActivePageWrapper(newPageHTML) {
  const wrapper = {
    head: {
      raw: newPageHTML.head.raw,
      final: await updateHtmlWithFieldData(newPageHTML.head.raw),
    },
    below: {
      raw: newPageHTML.below.raw,
      final: await updateHtmlWithFieldData(newPageHTML.below.raw),
    },
  };
  pages.update(get(id), (page) => ({
    ...page,
    wrapper,
  }));
}

export async function updateSiteWrapper(newSiteHTML) {
  const final = {
    head: await updateHtmlWithFieldData(
      newSiteHTML.head.raw,
    ),
    below: await updateHtmlWithFieldData(
      newSiteHTML.below.raw
    )
  }
  wrapper.set({
    ...get(wrapper),
    head: {
      raw: newSiteHTML.head.raw,
      final: final.head
    },
    below: {
      raw: newSiteHTML.below.raw,
      final: final.below
    }
  })
}

export async function emancipateInstances(symbol) {
  const updatedPages = await Promise.all(
    get(stores.pages).map(async (page) => {
      const updatedContent = await page.content.map(block => {
        if (block.symbolID === symbol.id) {
          const symbol = getSymbol(block.symbolID)
          return {
            ...block,
            symbolID: null,
            value: {
              ...symbol.value,
              fields: block.value.fields
            }
          }
        } else return block
      })
      return {
        ...page,
        content: updatedContent,
      };
    })
  );
  stores.pages.set(updatedPages)

  const activePageContent = _.find(updatedPages, ['id', get(id)])['content']
  content.set(activePageContent)
}

export function undoSiteChange() {
  const state = get(timeline)

  // Set timeline back
  const timelineWithoutLastChange = state.slice(0, state.length - 1)
  timeline.set(timelineWithoutLastChange)

  // Save removed states
  undone.update(u => ([...state.slice(state.length - 1), ...u]))

  // Set Site
  const siteWithoutLastChange = _.last(timelineWithoutLastChange)

  hydrateSite(siteWithoutLastChange)
}

export function redoSiteChange() {
  const restoredState = [...get(timeline), ...get(undone)]
  timeline.set(restoredState)
  hydrateSite(restoredState[restoredState.length - 1])
}

// experimenting with exporting objects to make things cleaner
export const symbols = {
  create: (symbol) => {
    unsaved.set(true)
    stores.symbols.update(s => [_.cloneDeep(symbol), ...s])
  },
  update: (toUpdate) => {
    unsaved.set(true)
    stores.symbols.update(symbols => {
      return symbols.map(s => s.id === toUpdate.id ? toUpdate : s)
    })
  },
  delete: (toDelete) => {
    unsaved.set(true)
    stores.symbols.update(symbols => {
      return symbols.filter(s => s.id !== toDelete.id)
    })
  }
}

export const pages = {
  add: (newpage, path) => {
    unsaved.set(true)
    const currentPages = get(stores.pages)
    let newPages = _.cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage = _.find(newPages, ['id', path[0]])
      rootPage.pages = rootPage.pages ? [...rootPage.pages, newpage] : [newpage]
    } else {
      newPages = [...newPages, newpage]
    }
    stores.pages.set(newPages)
  },
  delete: (pageId, path) => {
    unsaved.set(true)
    const currentPages = get(stores.pages)
    let newPages = _.cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage = _.find(newPages, ['id', path[0]])
      rootPage.pages = rootPage.pages.filter(page => page.id !== pageId)
    } else {
      newPages = newPages.filter(page => page.id !== pageId)
    }
    stores.pages.set(newPages)
  },
  update: async (pageId, fn) => {
    unsaved.set(true)
    const newPages = await Promise.all(
      get(stores.pages).map(async page => {
        if (page.id === pageId) {
          const newPage = await fn(page)
          return newPage
        } else if (_.some(page.pages, ['id', pageId])) {
          return {
            ...page,
            pages: page.pages.map(page => page.id === pageId ? fn(page) : page)
          }
        } else return page
      })
    )
    stores.pages.set(newPages)
  }
}