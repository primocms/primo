import { find, last, cloneDeep, some, chain, unset, omit, isEqual } from 'lodash-es'
import { get } from 'svelte/store'
import { browser } from '$app/environment'
import { id as activePageID, sections } from './app/activePage'
import { saved, locale } from './app/misc'
import * as stores from './data/draft'
import { content, code, fields, timeline, site as unsavedSite } from './data/draft'
import type { Site, Symbol, Page } from '../const'
import { validateSiteStructure } from '../utils'

export async function hydrateSite(data: Site): Promise<void> {
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

export async function updateHTML({ page, site }) {
  // active page
  pages.update(get(activePageID), (s) => ({
    ...s,
    code: {
      ...s.code,
      html: page
    }
  }));

  // site
  code.update(c => ({
    ...c,
    html: site
  }))

  timeline.push(get(unsavedSite))
}

export async function updateActivePageCSS(css: string): Promise<void> {
  pages.update(get(activePageID), (page) => ({
    ...page,
    code: {
      ...page.code,
      css
    }
  }));
  timeline.push(get(unsavedSite))
}

export async function updateSiteCSS(css: string): Promise<void> {
  code.update(c => ({
    ...c,
    css
  }))
  timeline.push(get(unsavedSite))
}

// when a Symbol is deleted from the Site Library, 
// delete every instance of it on the site as well (and their content)
export async function deleteInstances(symbol: Symbol): Promise<void> {

  // remove from page sections
  const sectionsToDeleteFromContent = []
  const updatedPages = cloneDeep(get(stores.pages)).map(removeInstancesFromPage)
  function removeInstancesFromPage(page) {
    const updatedSections = page.sections.filter(section => {
      if (section.symbolID === symbol.id) {
        const sectionPath = [page.id, section.id]
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
    sectionsToDeleteFromContent.forEach(path => unset(updatedSiteContent, [locale, ...path]))
  })

  stores.content.set(updatedSiteContent)
  stores.pages.set(updatedPages)
  timeline.push(get(unsavedSite))
}


export function undoSiteChange(): void {
  const undone = timeline.undo();
  hydrateSite(undone)
}

export function redoSiteChange(): void {
  const redone = timeline.redo()
  hydrateSite(redone)
}

export const symbols = {
  create: (symbol: Symbol): void => {
    saved.set(false)
    stores.symbols.update(s => [cloneDeep(symbol), ...s])
    timeline.push(get(unsavedSite))
  },
  update: (toUpdate: Symbol): void => {
    saved.set(false)
    stores.symbols.update(symbols => {
      return symbols.map(symbol => symbol.id === toUpdate.id ? ({
        ...symbol,
        ...toUpdate
      }) : symbol)
    })
    timeline.push(get(unsavedSite))
  },
  delete: (toDelete: Symbol): void => {
    saved.set(false)
    stores.symbols.update(symbols => {
      return symbols.filter(s => s.id !== toDelete.id)
    })
    timeline.push(get(unsavedSite))
  }
}

export const pages = {
  add: (newPage: Page, path: Array<string>, updateTimeline = true): void => {
    saved.set(false)
    const currentPages: Array<Page> = get(stores.pages)
    let updatedPages: Array<Page> = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage: Page = find(updatedPages, ['id', path[0]])
      rootPage.pages = rootPage.pages ? [...rootPage.pages, newPage] : [newPage]
    } else {
      updatedPages = [...updatedPages, newPage]
    }

    const updatedContent = chain(Object.entries(get(stores.content)).map(([locale, pages]) => ({
      locale,
      content: {
        ...pages,
        [newPage.id]: chain(newPage.sections).keyBy('id').mapValues(() => ({})).value()
      }
    }))).keyBy('locale').mapValues('content').value()

    stores.content.set(updatedContent)
    stores.pages.set(updatedPages)

    if (updateTimeline) timeline.push(get(unsavedSite))
  },
  delete: (pageId: string, path: Array<string>, updateTimeline = true): void => {
    saved.set(false)
    const currentPages: Array<Page> = get(stores.pages)
    let newPages: Array<Page> = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage = find(newPages, ['id', path[0]])
      rootPage.pages = rootPage.pages.filter(page => page.id !== pageId)
    } else {
      newPages = newPages.filter(page => page.id !== pageId)
    }

    const updatedContent = chain(Object.entries(get(stores.content)).map(([locale, pages]) => ({
      locale,
      content: omit(pages, [pageId])
    }))).keyBy('locale').mapValues('content').value()

    stores.content.set(updatedContent)
    stores.pages.set(newPages)
    if (updateTimeline) timeline.push(get(unsavedSite))
  },
  update: async (pageId: string, fn, updateTimeline = true) => {
    saved.set(false)
    const newPages = get(stores.pages).map(page => {
      if (page.id === pageId) {
        return fn(page)
      } else if (some(page.pages, ['id', pageId])) {
        return {
          ...page,
          pages: page.pages.map(page => page.id === pageId ? fn(page) : page)
        }
      } else return page
    })
    stores.pages.set(newPages)
    if (updateTimeline) timeline.push(get(unsavedSite))
  },
  edit: async (pageId: string, updatedPage: { id: string, name: string }, updateTimeline = true) => {
    const newPages = get(stores.pages).map(page => {
      if (page.id === pageId) { // root page
        return {
          ...page,
          ...updatedPage,
          pages: page.pages.map(subpage => ({ // update child page IDs
            ...subpage,
            id: subpage.id.replace(pageId, updatedPage.id)
          }))
        }
      } else if (some(page.pages, ['id', pageId])) { // child page
        return {
          ...page,
          pages: page.pages.map(subpage => subpage.id === pageId ? ({ ...subpage, ...updatedPage }) : subpage)
        }
      } else return page
    })
    const updatedContent = chain(Object.entries(get(stores.content)).map(([locale, pages]) => {

      // Replace root and child page IDs with new ID
      const updatedLocaleContent = chain(Object.entries(pages).map(([key, val]) => {
        console.log({ key, val })
        if (key === pageId) {
          return {
            key: updatedPage.id,
            val
          }
        }
        else if (key.includes(`${pageId}/`)) {
          return {
            key: key.replace(`${pageId}/`, `${updatedPage.id}/`),
            val
          }
        } else return { key, val }
      })).keyBy('key').mapValues('val').value()
      console.log({ updatedLocaleContent })
      return ({
        locale,
        content: updatedLocaleContent
      })
    })).keyBy('locale').mapValues('content').value()

    stores.content.set(updatedContent)
    stores.pages.set(newPages)
    if (updateTimeline) timeline.push(get(unsavedSite))
  }
}

export async function deleteSection(sectionID) {

  // delete section content from all locales
  const updatedContent = cloneDeep(get(content))
  const pageID = get(activePageID)
  const updatedPage = cloneDeep(updatedContent[get(locale)][pageID])
  delete updatedPage[sectionID]

  for (const [locale, pages] of Object.entries(updatedContent)) {
    updatedContent[locale] = {
      ...pages,
      [pageID]: updatedPage
    }
  }
  content.set(updatedContent)

  // delete section from page
  const updatedSections = get(sections).filter(s => s.id !== sectionID)
  pages.update(pageID, (page) => ({
    ...page,
    sections: updatedSections
  }), false);

  timeline.push(get(unsavedSite))
}

export async function updateContent(blockID, updatedValue, activeLocale = get(locale)) {
  const currentContent = get(content)
  const pageID = get(activePageID)
  const localeExists = !!currentContent[activeLocale]
  const pageExists = localeExists ? !!currentContent[activeLocale][pageID] : false
  const blockExists = pageExists ? !!currentContent[activeLocale][pageID][blockID] : false

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
    for (let locale of Object.keys(currentContent)) {
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

  timeline.push(get(unsavedSite))
}

export async function saveFields(newPageFields, newSiteFields, newContent) {
  pages.update(get(activePageID), (page) => ({
    ...page,
    fields: cloneDeep(newPageFields),
  }));
  fields.set(newSiteFields);
  content.set(newContent)
  timeline.push(get(unsavedSite))
}

export async function addLocale(key) {
  content.update(s => ({
    ...s,
    [key]: s['en']
  }))
  timeline.push(get(unsavedSite))
}

export async function removeLocale(key) {
  locale.set('en')
  content.update(s => {
    const updatedContent = cloneDeep(s)
    delete updatedContent[key]
    return updatedContent
  })
  timeline.push(get(unsavedSite))
}

export async function changeLocale() {
  const locales = Object.keys(get(content))
  const loc = get(locale)
  locales.reduce((a, b, i) => {
    if (a === loc) locale.set(b) // switch to next locale
    else if (i === locales.length - 1) locale.set(locales[0]) // switch to first locale
  })
}

export async function updatePreview(updatedSite = get(unsavedSite)) {
  if (!browser) return
  const channel = new BroadcastChannel('site_preview')
  channel.postMessage({
    site: updatedSite,
    pageID: get(activePageID)
  })
}