import { find, last, cloneDeep, some, chain, unset, omit, omitBy, isEqual } from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import * as activePage from './app/activePage'
import { id as activePageID } from './app/activePage'
import sections from './data/sections'
import pages_store from './data/pages'
import { saved, locale, hoveredBlock } from './app/misc'
import * as stores from './data/draft'
import { update as update_site, content, code, fields, timeline, site as unsavedSite } from './data/draft'
import { buildStaticPage } from './helpers'
import type { Site as SiteType, Symbol as SymbolType, Page as PageType } from '../const'
import { Page } from '../const'
import { createUniqueID } from '../utilities';
import { getSymbol } from './helpers'
import * as supabaseDB from '$lib/supabase'
import { supabase } from '$lib/supabase'
import { invalidate } from '$app/navigation'
import { swap_array_item_index } from '$lib/utils'
import { v4 as uuidv4 } from 'uuid';

export async function hydrateSite(data: SiteType): Promise<void> {
  // const site = validate_site_structure_v2(data)
  const site = data
  if (!site) return
  sections.set([])
  stores.id.set(site.id)
  stores.name.set(site.name)
  // stores.pages.set(site.pages)

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
  create: async (symbol) => {
    // saved.set(false)
    stores.symbols.update(s => [symbol, ...s])
    const res = await supabase.from('symbols').insert(symbol)
    timeline.push(get(unsavedSite))
    // return data.id
  },
  update: async (toUpdate) => {
    // saved.set(false)
    stores.symbols.update(symbols => {
      return symbols.map(symbol => symbol.id === toUpdate.id ? ({
        ...symbol,
        ...toUpdate
      }) : symbol)
    })

    sections.update(s => s.map(section => ({
      ...section,
      symbol: section.symbol.id === toUpdate.id ? {
        ...section.symbol,
        ...toUpdate
      } : section.symbol
    })))

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

export const active_site = {
  update: async (props) => {
    update_site(props)
    await supabase.from('sites').update(props).eq('id', get(unsavedSite)['id'])
  },
  create_repo: async () => {

  }
}

export const active_page = {
  add_symbol: async (symbol, position) => {

    const instance = {
      id: null,
      index: position,
      page: get(activePageID),
      content: symbol.content,
      symbol
    }

    sections.update(sections => [
      ...sections.slice(0, position),
      instance,
      ...sections.slice(position),
    ])

    const { data } = await supabase.from('sections').insert({
      symbol: symbol.id,
      page: get(activePageID),
      index: position,
      content: symbol.content || {},
    }).select('*, symbol(*)')

    sections.update(sections => sections.map(section => section.id === null ? data[0] : section))

    const preview = await buildStaticPage({ page: get(activePage.default), no_js: true })
    pages_store.update(pages => pages.map(page => page.id === get(activePageID) ? ({ ...page, preview }) : page))
    await supabase.from('pages').update({ preview }).eq('id', get(activePageID))

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
        id: get(activePageID),
        site: get(unsavedSite)['id']
      })

    const preview = await buildStaticPage({ page: get(activePage.default), no_js: true })
    pages_store.update(pages => pages.map(page => page.id === get(activePageID) ? ({ ...page, preview }) : page))
    await supabase.from('pages').update({ preview }).eq('id', get(activePageID))

    if (updateTimeline) timeline.push(get(unsavedSite))
  },
}

export const pages = {
  duplicate: async ({ page, path = [], details, updateTimeline = true }) => {
    // saved.set(false)

    const new_page = {
      id: uuidv4(),
      name: details.name,
      url: details.url,
      code: page.code,
      content: page.content,
      fields: page.fields,
      preview: page.preview,
      site: get(unsavedSite)['id']
    }

    pages.add(new_page, [])

    const { data: sections } = await supabase.from('sections').select().eq('page', page.id)

    const newest = await supabase.from('sections').insert(sections.map(section => ({
      content: section.content,
      index: section.index,
      page: new_page.id,
      symbol: section.symbol
    })))


    if (updateTimeline) timeline.push(get(unsavedSite))

  },
  add: async (newPage: PageType, path: Array<string>, updateTimeline = true) => {
    saved.set(false)
    const currentPages = get(pages_store)

    // if (path.length > 0) {
    //   const rootPage: PageType = find(updatedPages, ['id', path[0]])
    //   rootPage.pages = rootPage.pages ? [...rootPage.pages, newPage] : [newPage]
    // } else {
    //   updatedPages = [...updatedPages, newPage]
    // }

    console.log({ newPage })
    pages_store.set([...cloneDeep(currentPages), newPage])
    const { data } = await supabase.from('pages').insert({
      ...newPage,
      site: get(unsavedSite)['id']
    }).select()

    if (data) {
      pages_store.update(store => store.map(page => page.id === newPage.id ? data[0] : page))
    } else {
      pages_store.update(store => store.filter(page => page.id !== newPage.id))
    }

    if (updateTimeline) timeline.push(get(unsavedSite))
  },
  delete: async (pageId: string, updateTimeline = true) => {
    // saved.set(false)
    pages_store.update(pages => pages.filter(page => page.id !== pageId))

    const { data: sections_to_delete } = await supabase.from('sections').select('id, page!inner(*)').filter('page.id', 'eq', pageId)
    await Promise.all(
      sections_to_delete.map(async section => {
        await supabase.from('sections').delete().eq('id', section.id)
      })
    )
    await supabase.from('pages').delete().eq('id', pageId)

    if (updateTimeline) timeline.push(get(unsavedSite))
  },
  update: async (pageId: string, fn, updateTimeline = true) => {
    saved.set(false)
    const newPages = get(pages_store).map(page => {
      if (page.id === pageId) {
        return fn(page)
      } else if (some(page.pages, ['id', pageId])) {
        return {
          ...page,
          // pages: page.pages.map(page => page.id === pageId ? fn(page) : page)
        }
      } else return page
    })
    pages_store.set(newPages)
    if (updateTimeline) timeline.push(get(unsavedSite))
  },
  edit: async (pageId: string, updatedPage: { id: string, name: string }, updateTimeline = true) => {
    const newPages = get(pages_store).map(page => {
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

    pages_store.set(newPages)
    if (updateTimeline) timeline.push(get(unsavedSite))
  }
}

export async function deleteSection(sectionID) {
  const updatedSections = get(sections).filter(s => s.id !== sectionID)
  sections.set(updatedSections)

  const preview = await buildStaticPage({ page: get(activePage.default), no_js: true })
  pages_store.update(pages => pages.map(page => page.id === get(activePageID) ? ({ ...page, preview }) : page))

  await supabase.from('sections').delete().eq('id', sectionID)

  timeline.push(get(unsavedSite))
}

export async function update_symbol_with_static_values(component) {
  const { symbol } = component
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
    id: symbol.id,
    content: updated_symbol.content
  })
}

export async function update_section_content(section, updated_content) {
  sections.set(get(sections).map(s => s.id === section.id ? { ...s, content: updated_content } : s))
  await supabase.from('sections').update({ content: updated_content }).eq('id', section.id)
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