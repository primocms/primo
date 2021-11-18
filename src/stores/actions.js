import { find, last, cloneDeep, some } from 'lodash-es'
import { get } from 'svelte/store'
import { getSymbol } from './helpers'
import { id, sections } from './app/activePage'
import { saved } from './app/misc'
import { html, css, fields } from './data/draft'
import * as stores from './data/draft'
import { timeline, undone, site as unsavedSite } from './data/draft'
import site from './data/site'
import {DEFAULTS} from '../const'

export async function saveSite() {
  const finalSave = get(unsavedSite)
  console.log({finalSave})
  site.save(finalSave)
}

export async function hydrateSite(data) {
  sections.set([])
  stores.id.set(data.id)
  stores.name.set(data.name)
  stores.pages.set(data.pages)

  css.set(data.css || DEFAULTS.css)
  html.set(data.html || DEFAULTS.html)
  fields.set(data.fields)
  stores.symbols.set(data.symbols)
}

export async function updateActivePageWrapper(html) {
  pages.update(get(id), (page) => ({
    ...page,
    html,
  }));
}


export async function updateSiteWrapper(newSiteHTML) {
  html.set(newSiteHTML)
}

// when a Symbol is deleted from the Site Library, 
// it's instances on the page are emancipated
export async function emancipateInstances(symbol) {
  const updatedPages = await Promise.all(
    get(stores.pages).map(async (page) => {
      const updatedSections = await page.sections.map(block => {
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
        sections: updatedSections,
      };
    })
  );
  stores.pages.set(updatedPages)

  const activePageSections = find(updatedPages, ['id', get(id)])['sections']
  sections.set(activePageSections)
}

export function undoSiteChange() {
  const state = get(timeline)

  // Set timeline back
  const timelineWithoutLastChange = state.slice(0, state.length - 1)
  timeline.set(timelineWithoutLastChange)

  // Save removed states
  undone.update(u => ([...state.slice(state.length - 1), ...u]))

  // Set Site
  const siteWithoutLastChange = last(timelineWithoutLastChange)

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
    saved.set(false)
    stores.symbols.update(s => [cloneDeep(symbol), ...s])
  },
  update: (toUpdate) => {
    saved.set(false)
    stores.symbols.update(symbols => {
      return symbols.map(s => s.id === toUpdate.id ? toUpdate : s)
    })
  },
  delete: (toDelete) => {
    saved.set(false)
    stores.symbols.update(symbols => {
      return symbols.filter(s => s.id !== toDelete.id)
    })
  }
}

export const pages = {
  add: (newpage, path) => {
    saved.set(false)
    const currentPages = get(stores.pages)
    let newPages = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage = find(newPages, ['id', path[0]])
      rootPage.pages = rootPage.pages ? [...rootPage.pages, newpage] : [newpage]
    } else {
      newPages = [...newPages, newpage]
    }
    console.log({newPages})
    stores.pages.set(newPages)
  },
  delete: (pageId, path) => {
    saved.set(false)
    const currentPages = get(stores.pages)
    let newPages = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage = find(newPages, ['id', path[0]])
      rootPage.pages = rootPage.pages.filter(page => page.id !== pageId)
    } else {
      newPages = newPages.filter(page => page.id !== pageId)
    }
    stores.pages.set(newPages)
  },
  update: async (pageId, fn) => {
    saved.set(false)
    const newPages = await Promise.all(
      get(stores.pages).map(async page => {
        if (page.id === pageId) {
          const newPage = await fn(page)
          return newPage
        } else if (some(page.pages, ['id', pageId])) {
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