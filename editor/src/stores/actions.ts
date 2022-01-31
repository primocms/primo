import { find, last, cloneDeep, some, chain } from 'lodash-es'
import { get } from 'svelte/store'
import { getSymbol } from './helpers'
import { id as activePageID, sections } from './app/activePage'
import { saved, locale } from './app/misc'
import * as stores from './data/draft'
import { content, code, fields, timeline, undone, site as unsavedSite } from './data/draft'
import type { Site, Symbol, Page } from '../const'

export async function hydrateSite(data:Site): Promise<void> {
  console.log({data})
  sections.set([])
  stores.id.set(data.id)
  stores.name.set(data.name)
  stores.pages.set(data.pages)

  code.set(data.code)
  fields.set(data.fields)
  stores.symbols.set(data.symbols)
  stores.content.set(data.content)
}

export async function updateActivePageHTML(html:string): Promise<void> {
  pages.update(get(activePageID), (page) => ({
    ...page,
    code: {
      ...page.code,
      html
    }
  }));
}

export async function updateActivePageCSS(css:string): Promise<void> {
  pages.update(get(activePageID), (page) => ({
    ...page,
    code: {
      ...page.code,
      css
    }
  }));
}


export async function updateSiteHTML(html:{ head:string, below:string }): Promise<void> {
  code.update(c => ({
    ...c,
    html
  }))
}

export async function updateSiteCSS(css:string): Promise<void> {
  code.update(c => ({
    ...c,
    css
  }))
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
            fields: block.fields
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

  const activePageSections = find(updatedPages, ['id', get(activePageID)])['sections']
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

export async function updateContent(blockID, updatedValue, activeLocale = get(locale)) {
  const currentContent = get(content)
  const pageID = get(activePageID)
  const localeExists = !!currentContent[activeLocale]
  const pageExists = localeExists ? !!currentContent[activeLocale][pageID] : false
  const blockExists = pageExists ? !!currentContent[activeLocale][pageID][blockID] : false

  if (!updatedValue) { // Delete block from all locales
    const updatedPage = currentContent[activeLocale][pageID]
    delete updatedPage[blockID]
    content.update(content => {
      for (const [ locale, pages ] of Object.entries(content)) {
        content[locale] = {
          ...pages, // idk why TS is complaining about this
          [pageID]: updatedPage
        }
      }
      return content
    })
    return
  }

  if (blockExists) {
    content.update(content => ({
      ...content,
      [activeLocale]: {
        ...content[activeLocale],
        [pageID]: {
          ...content[activeLocale][pageID],
          [blockID]: updatedValue
        }
      }
    }))
  } else {
    // create matching block in all locales
    for(let [ locale, pages ] of Object.entries(currentContent)) {
      content.update(c => ({
        ...c,
        [locale]: {
          ...c[locale],
          [pageID]: {
            ...c[locale][pageID],
            [blockID]: updatedValue
          }
        }
      }))
    }
  }
}

export async function saveFields(newPageFields, newSiteFields) {
  pages.update(get(activePageID), (page) => ({
    ...page,
    fields: cloneDeep(newPageFields),
  }));
  fields.set(newSiteFields);

  const activeLocale = get(locale)
  const pageID = get(activePageID)
  const pageData = chain(
    newPageFields.map(
      field => ({
        key: field.key,
        value: field.value
      })
    ))
    .keyBy("key")
    .mapValues("value")
    .value();
  const siteData = chain(
    newSiteFields.map(
      field => ({
        key: field.key,
        value: field.value
      })
    ))
    .keyBy("key")
    .mapValues("value")
    .value();
  content.update(content => ({
    ...content,
    [activeLocale]: {
      ...content[activeLocale],
      ...siteData,
      [pageID]: {
        ...content[activeLocale][pageID],
        ...pageData
      }
    }
  }))
}


export async function addLocale(key) {
  content.update(s => ({
    ...s,
    [key]: s.en
  }))
}