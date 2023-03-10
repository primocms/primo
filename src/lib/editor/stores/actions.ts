import { find, last, cloneDeep, some, chain, unset, omit, omitBy, isEqual } from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import * as activePage from './app/activePage'
import { id as activePageID } from './app/activePage'
import sections from './data/sections'
import { saved, locale, hoveredBlock } from './app/misc'
import * as stores from './data/draft'
import { content, code, fields, timeline, site as unsavedSite } from './data/draft'
import { buildStaticPage } from './helpers'
import type { Site as SiteType, Symbol as SymbolType, Page as PageType } from '../const'
import { Page } from '../const'
import { validateSiteStructure } from '../utils'
import { createUniqueID } from '../utilities';
import { getSymbol } from './helpers'
import * as supabaseDB from '$lib/supabase'
import { supabase } from '$lib/supabase'
import { invalidate } from '$app/navigation'
import { swap_array_item_index } from '$lib/utils'

export async function hydrateSite(data: SiteType): Promise<void> {
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
  // pages.update(get(activePageID), (s) => ({
  //   ...s,
  //   code: {
  //     ...s.code,
  //     html: page
  //   }
  // }));

  // page
  activePage.set({
    code: {
      ...get(activePage).code,
      html: page
    }
  })

  // site
  code.update(c => ({
    ...c,
    html: site
  }))

  // await supabase.from('pages').update({ code })

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
export async function deleteInstances(symbol: SymbolType): Promise<void> {

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
      // pages: page.pages.map(removeInstancesFromPage)
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
  create: async (symbol: SymbolType): void => {
    // saved.set(false)
    // supabaseDB.update_row('sites', get(unsavedSite)['id'], {
    //   symbols: [...get(unsavedSite)['symbols'], symbol]
    // })
    stores.symbols.update(s => [cloneDeep(symbol), ...s])
    const { id } = await supabaseDB.create_row('symbols', symbol)
    timeline.push(get(unsavedSite))
    return id
  },
  update: async (toUpdate) => {
    // saved.set(false)

    stores.symbols.update(symbols => {
      return symbols.map(symbol => symbol.id === toUpdate.id ? ({
        ...symbol,
        ...toUpdate
      }) : symbol)
    })

    await supabaseDB.update_row('symbols', toUpdate.id, toUpdate)
    timeline.push(get(unsavedSite))
  },
  delete: async (toDelete: SymbolType) => {
    // saved.set(false)
    stores.symbols.update(symbols => symbols.filter(s => s.id !== toDelete.id))
    await supabase.from('sections').delete().eq('symbol', toDelete.id) // delete instances
    await supabaseDB.delete_row('symbols', toDelete.id)
    timeline.push(get(unsavedSite))
  }
}

export const active_page = {
  add_block: async (symbol, position) => {
    // set page store
    // console.log('ACTIVEPAGE', symbol, position)
    // sections.set([
    //   ...get(sections).slice(0, position),
    //   symbol,
    //   ...get(sections).slice(position),
    // ])

    const { data } = await supabase.from('sections').insert({
      symbol: symbol.id,
      page: get(activePageID),
      index: position,
      content: symbol.content || {},
    }).select('*, symbol(*)')

    const preview = await buildStaticPage({ page: get(activePage.default) })
    await supabase.from('pages').update({ preview }).eq('id', get(activePageID))

    sections.update(sections => [
      ...sections.slice(0, position),
      data[0],
      ...sections.slice(position),
    ])

    // create row in sections table w/ given order
    // modify other rows w/ new indeces or order by last updated

  },
  move_block: async (from, to) => {
    const block = get(sections)[from]
    const block_being_replaced = get(sections)[to]
    const updated = swap_array_item_index(get(sections), from, to)
    sections.set(updated)
    await supabase.from('sections').update({ index: from }).eq('id', block_being_replaced.id)
    await supabase.from('sections').update({ index: to }).eq('id', block.id)
  },
  update: async (obj, updateTimeline = true) => {
    activePage.set(obj)

    await supabase.from('pages').update(obj).match(
      {
        url: get(activePageID),
        site: get(unsavedSite)['id']
      })

    if (updateTimeline) timeline.push(get(unsavedSite))
  },
}

export const pages = {
  duplicate: ({ page, path = [], details, updateTimeline = true }) => {
    // saved.set(false)
    // const currentPages = get(stores.pages)
    // let updatedPages = cloneDeep(currentPages)

    // const [newSections, IDs] = scrambleIds(page.sections)
    // const newPage = cloneDeep({
    //   ...Page(),
    //   ...page,
    //   ...details,
    //   sections: newSections
    // });

    // if (path.length > 0) {
    //   const rootPage: PageType = find(updatedPages, ['id', path[0]])
    //   rootPage.pages = rootPage.pages ? [...rootPage.pages, newPage] : [newPage]
    // } else {
    //   updatedPages = [...updatedPages, newPage]
    // }

    // const updatedContent = chain(Object.entries(get(stores.content)).map(([locale, pages]) => {
    //   const duplicatedSectionContent = chain(newPage.sections).keyBy('id').mapValues((section) => {
    //     const { old } = find(IDs, i => i.new === section.id)
    //     return pages[page.id][old] // set content from duplicated page
    //   }).value()
    //   const duplicatedPageContent = chain(newPage.fields).keyBy('key').mapValues(field => pages[page.id][field.key]).value()

    //   return {
    //     locale,
    //     content: {
    //       ...pages,
    //       [newPage.id]: {
    //         ...duplicatedSectionContent,
    //         ...duplicatedPageContent
    //       }
    //     }
    //   }
    // })).keyBy('locale').mapValues('content').value()

    // stores.content.set(updatedContent)
    // stores.pages.set(updatedPages)

    supabase.from('pages').insert(page)
    invalidate('app:data')

    if (updateTimeline) timeline.push(get(unsavedSite))

  },
  add: async (newPage: PageType, path: Array<string>, updateTimeline = true) => {
    saved.set(false)
    const currentPages: Array<PageType> = get(stores.pages)
    let updatedPages: Array<PageType> = cloneDeep(currentPages)
    if (path.length > 0) {
      const rootPage: PageType = find(updatedPages, ['id', path[0]])
      rootPage.pages = rootPage.pages ? [...rootPage.pages, newPage] : [newPage]
    } else {
      updatedPages = [...updatedPages, newPage]
    }

    delete newPage.id
    const res = await supabase.from('pages').insert({
      ...newPage,
      site: get(unsavedSite)['id']
    }).select()
    stores.pages.set(updatedPages)

    if (updateTimeline) timeline.push(get(unsavedSite))
  },
  delete: async (pageId: string, updateTimeline = true) => {
    // saved.set(false)
    // const currentPages = get(stores.pages)
    // let newPages = cloneDeep(currentPages)
    // const [root, child] = pageId.split('/')
    // if (child) {
    //   const rootPage = find(newPages, ['id', root])
    //   rootPage.pages = rootPage.pages.filter(page => page.id !== pageId)
    //   newPages = newPages.map(page => page.id === root ? rootPage : page)
    // } else {
    //   newPages = newPages.filter(page => page.id !== root)
    // }
    // console.log({ currentPages, newPages })
    await supabase.from('pages').delete().filter('id', 'eq', pageId)
    invalidate('app:data')

    // stores.pages.set(newPages)
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
          // pages: page.pages.map(page => page.id === pageId ? fn(page) : page)
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
          // pages: page.pages.map(subpage => ({ // update child page IDs
          //   ...subpage,
          //   id: subpage.id.replace(pageId, updatedPage.id)
          // }))
        }
      } else if (some(page.pages, ['id', pageId])) { // child page
        return {
          ...page,
          // pages: page.pages.map(subpage => subpage.id === pageId ? ({ ...subpage, ...updatedPage }) : subpage)
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
  const updatedSections = get(sections).filter(s => s.id !== sectionID)
  sections.set(updatedSections)
  await supabase.from('sections').delete().eq('id', sectionID)


  timeline.push(get(unsavedSite))
}

export async function update_symbol_with_static_values(component) {
  const symbol = getSymbol(component.symbolID)
  let updated_symbol = cloneDeep({
    ...symbol,
    ...component
  })
  for (let field of symbol.fields) {
    if (field.is_static) {
      const component_field_value = component.content[get(locale)][field.key]
      updated_symbol.content[get(locale)][field.key] = component_field_value
    }
  }
  symbols.update({
    id: component.symbolID,
    content: updated_symbol.content
  })
}

export async function update_section_content(section, updated_content) {
  console.log('UPDATE', section, updated_content)
  sections.set(get(sections).map(s => s.id === section.id ? { ...s, content: updated_content } : s))
  await supabase.from('sections').update({ content: updated_content }).eq('id', section.id)
}

export async function updateContent(block, updatedValue, activeLocale = get(locale)) {
  const currentContent = get(content)
  const pageID = get(activePageID)
  const localeExists = !!currentContent[activeLocale]
  const pageExists = localeExists ? !!currentContent[activeLocale][pageID] : false
  const blockExists = find(get(sections), ['id', block.id])

  const blockID = null

  console.log({ block, blockExists, currentContent, pageID })
  if (blockExists) {
    console.log('yeah')
    const updated_content = {
      ...currentContent,
      [activeLocale]: {
        ...currentContent[activeLocale],
        [pageID]: {
          ...currentContent[activeLocale][pageID],
          [blockID]: updatedValue
        }
      }
    }
    await supabase.from('sites').update({
      content: updated_content
    }).filter('id', 'eq', get(unsavedSite)['id'])

  } else {
    // create matching block in all locales
    // console.log('updated_content', updated_content)

    // const updated_content = _.mapValues(_.keyBy(Object.keys(currentContent).map(locale => ({
    //   locale,
    //   value: {
    //     ...currentContent[locale],
    //     [pageID]: {
    //       ...currentContent[locale][pageID],
    //       [blockID]: updatedValue
    //     }
    //   }
    // })), 'locale'), 'value')

    // await supabase.from('sites').update({
    //   content: updated_content
    // }).filter('id', 'eq', get(unsavedSite)['id'])

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
  if (import.meta.env.SSR) return
  const channel = new BroadcastChannel('site_preview')
  channel.postMessage({
    site: updatedSite,
    pageID: get(activePageID)
  })
}