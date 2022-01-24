import { find, last, cloneDeep, some } from 'lodash-es'
import { get } from 'svelte/store'
import { getSymbol } from './helpers'
import { id, sections } from './app/activePage'
import { saved } from './app/misc'
import { html, css, fields } from './data/draft'
import * as stores from './data/draft'
import { timeline, undone } from './data/draft'
import {DEFAULTS} from '../const'
import type { Site, Symbol, Page } from '../const'

export async function hydrateSite(data:Site): Promise<void> {
  sections.set([])
  stores.id.set(data.id)
  stores.name.set(data.name)
  stores.pages.set(data.pages)

  css.set(data.css || DEFAULTS.css)
  html.set(data.html || DEFAULTS.html)
  fields.set(data.fields)
  stores.symbols.set(data.symbols)
}

export async function updateActivePageHTML(html:string): Promise<void> {
  pages.update(get(id), (page) => ({
    ...page,
    html,
  }));
}


export async function updateSiteHTML(newSiteHTML:{ head:string, below:string }): Promise<void> {
  html.set(newSiteHTML)
}

// when a Symbol is deleted from the Site Library, 
// it's instances on the page are emancipated
export async function emancipateInstances(symbol:Symbol): Promise<void> {
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

export function undoSiteChange(): void {
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

export function redoSiteChange(): void {
  const restoredState = [...get(timeline), ...get(undone)]
  timeline.set(restoredState)
  hydrateSite(restoredState[restoredState.length - 1])
}

export const symbols = {
  create: (symbol:Symbol): void => {
    saved.set(false)
    stores.symbols.update(s => [cloneDeep(symbol), ...s])
  },
  update: (toUpdate:Symbol): void => {
    saved.set(false)
    stores.symbols.update(symbols => {
      return symbols.map(s => s.id === toUpdate.id ? toUpdate : s)
    })
  },
  delete: (toDelete:Symbol): void => {
    saved.set(false)
    stores.symbols.update(symbols => {
      return symbols.filter(s => s.id !== toDelete.id)
    })
  }
}

export const pages = {
  add: (newpage:Page, path:string): void => {
    saved.set(false)
    const currentPages:Array<Page> = get(stores.pages)
    let newPages:Array<Page> = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage:Page = find(newPages, ['id', path[0]])
      rootPage.pages = rootPage.pages ? [...rootPage.pages, newpage] : [newpage]
    } else {
      newPages = [...newPages, newpage]
    }
    stores.pages.set(newPages)
  },
  delete: (pageId:string, path:string): void => {
    saved.set(false)
    const currentPages:Array<Page> = get(stores.pages)
    let newPages:Array<Page> = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage = find(newPages, ['id', path[0]])
      rootPage.pages = rootPage.pages.filter(page => page.id !== pageId)
    } else {
      newPages = newPages.filter(page => page.id !== pageId)
    }
    stores.pages.set(newPages)
  },
  update: async (pageId:string, fn = (p) => {}) => {
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


export async function addLocale(key) {
  content.update(s => ({
    ...s,
    [key]: s.en
  }))
}