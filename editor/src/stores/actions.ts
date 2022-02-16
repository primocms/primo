import { find, last, cloneDeep, some, chain, unset } from 'lodash-es'
import { get } from 'svelte/store'
import { getSymbol } from './helpers'
import { id as activePageID, sections } from './app/activePage'
import { saved, locale } from './app/misc'
import * as stores from './data/draft'
import { content, code, fields, timeline, undone, site as unsavedSite } from './data/draft'
import type { Site, Symbol, Page } from '../const'
import { validateSiteStructure } from '../utils'

export async function hydrateSite(data:Site): Promise<void> {
  const site = validateSiteStructure(data)
  if (!site) return
  sections.set([])
  stores.id.set(site.id)
  stores.name.set(site.name)
  stores.pages.set(site.pages)

  code.set(site.code)
  fields.set(site.fields)
  stores.symbols.set(site.symbols)
  stores.content.set(site.content)
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
// delete every instance of it on the site as well (and their content)
export async function deleteInstances(symbol:Symbol): Promise<void> {

  // remove from page sections
  const sectionsToDeleteFromContent = []
  const updatedPages = cloneDeep(get(stores.pages)).map(removeInstancesFromPage)
  function removeInstancesFromPage(page) {
    const updatedSections = page.sections.filter(section => {
      if (section.symbolID === symbol.id) {
        const sectionPath = [ page.id, section.id ]
        sectionsToDeleteFromContent.push(sectionPath)
      } else return true
    })
    return {
      ...page,
      sections: updatedSections,
      pages: page.pages.map(removeInstancesFromPage)
    };
  }

  // remove sections from content tree
  const updatedSiteContent = cloneDeep(get(stores.site).content)
  const locales = Object.keys(get(stores.site).content)
  locales.forEach(locale => {
    sectionsToDeleteFromContent.forEach(path => unset(updatedSiteContent, [ locale, ...path ]))
  })

  stores.content.set(updatedSiteContent)
  stores.pages.set(updatedPages)
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
  add: (newPage:Page, path:string): void => {
    saved.set(false)
    const currentPages:Array<Page> = get(stores.pages)
    let updatedPages:Array<Page> = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage:Page = find(updatedPages, ['id', path[0]])
      rootPage.pages = rootPage.pages ? [...rootPage.pages, newPage] : [newPage]
    } else {
      updatedPages = [...updatedPages, newPage]
    }

    const updatedContent = chain(Object.entries(get(stores.content)).map(([ locale, pages ]) => ({
      locale,
      content: {
        ...pages,
        [newPage.id]: chain(newPage.sections).keyBy('id').mapValues(() => ({})).value()
      }
    }))).keyBy('locale').mapValues('content').value()

    stores.content.set(updatedContent)
    stores.pages.set(updatedPages)
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
    for(let locale of Object.keys(currentContent)) {
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

export async function saveFields(newPageFields, newSiteFields, newContent) {
  pages.update(get(activePageID), (page) => ({
    ...page,
    fields: cloneDeep(newPageFields),
  }));
  fields.set(newSiteFields);
  content.set(newContent)
}


export async function addLocale(key) {
  content.update(s => ({
    ...s,
    [key]: s.en
  }))
}

export async function changeLocale() {
  const locales = Object.keys(get(content))
  const loc = get(locale)
  locales.reduce((a, b, i) => {
    if (a === loc) locale.set(b) // switch to next locale
    else if (i === locales.length - 1) locale.set(locales[0]) // switch to first locale
  })
}