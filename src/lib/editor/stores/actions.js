import { find, cloneDeep, some } from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import * as activePage from './app/activePage'
import { id as activePageID } from './app/activePage'
import { locale } from './app/misc'
import stores, { update_timeline } from './data'
import { update as update_site, content, site as unsavedSite } from './data/site'
import { timeline } from './data'
import { buildStaticPage } from './helpers'
import { supabase } from '$lib/supabase'
import { swap_array_item_index } from '$lib/utils'
import { v4 as uuidv4 } from 'uuid';

/**
 * Hydrates the active site, page, section, and symbol stores for th editor
 * @param {import('$lib').Site_Data} data - Combined data object from the server
 */
export async function hydrate_active_data(data) {
  stores.sections.set(data.sections)
  stores.pages.set(data.pages)
  stores.symbols.set(data.symbols)
  update_site(data.site)
}

/** @returns {void} */
export function undo_change() {
  const { current } = get(timeline)
  current?.undoing(current.data)

  const undone = timeline.undo();
  // hydrate_active_data(undone.data)
}

/** @returns {void} */
export function redo_change() {
  const { data, doing } = timeline.redo()
  // hydrate_active_data(data)
  doing(data)
}

export const symbols = {
  create: async (symbol, index = 0) => {
    update_timeline({
      doing: async () => {
        stores.symbols.update(store => [
          ...store.slice(0, index),
          symbol,
          ...store.slice(index)
        ])
        await supabase.from('symbols').insert(symbol)
      },
      undoing: async () => {
        stores.symbols.update(store => store.filter(s => s.id !== symbol.id))
        await supabase.from('symbols').delete().eq('id', symbol.id)
      }
    })
  },
  update: async (updated_symbol) => {
    // saved.set(false)

    const original_symbol = _.cloneDeep(find(get(stores.symbols), { id: updated_symbol.id }))
    const original_symbols = _.cloneDeep(get(stores.symbols))
    const original_sections = _.cloneDeep(get(stores.sections))

    update_timeline({
      doing: async () => {

        stores.symbols.update(store => store.map(symbol => symbol.id === updated_symbol.id ? ({
          ...symbol,
          ...updated_symbol
        }) : symbol))

        stores.sections.update(store => store.map(section => ({
          ...section,
          symbol: section.symbol.id === updated_symbol.id ? {
            ...section.symbol,
            ...updated_symbol
          } : section.symbol
        })))

        await supabase.from('symbols').update(updated_symbol).eq('id', updated_symbol.id)
      },
      undoing: async () => {
        stores.symbols.set(original_symbols)
        stores.sections.set(original_sections)
        await supabase.from('symbols').update(original_symbol).eq('id', updated_symbol.id)
      }
    })
  },
  delete: async (symbol_to_delete) => {
    // saved.set(false)

    const original_symbols = _.cloneDeep(get(stores.symbols))
    const original_sections = _.cloneDeep(get(stores.sections))

    let deleted_sections

    // tested
    update_timeline({
      doing: async () => {
        stores.sections.update(store => store.filter(section => section.symbol.id !== symbol_to_delete.id))
        const res = await supabase.from('sections').delete().eq('symbol', symbol_to_delete.id).select() // delete instances
        deleted_sections = res.data // to re-add in undoing

        stores.symbols.update(symbols => symbols.filter(s => s.id !== symbol_to_delete.id))
        await supabase.from('symbols').delete().eq('id', symbol_to_delete.id)
      },
      undoing: async () => {
        stores.symbols.set(original_symbols)
        stores.sections.set(original_sections)
        await supabase.from('symbols').insert(symbol_to_delete)
        await supabase.from('sections').insert(deleted_sections) // re-add instances
      }
    })
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
  add_block: async (symbol, position) => {
    const original_sections = _.cloneDeep(get(stores.sections))

    const new_section = {
      id: uuidv4(),
      index: position,
      page: get(activePageID),
      content: symbol.content,
      symbol
    }

    const new_sections = [
      ...original_sections.slice(0, position),
      new_section,
      ...original_sections.slice(position)
    ].map((section, i) => ({ ...section, index: i }))

    update_timeline({
      doing: async () => {
        stores.sections.set(new_sections)
        await supabase.from('sections').upsert(new_sections.map(s => ({ ...s, symbol: s.symbol.id })))
      },
      undoing: async () => {
        stores.sections.set(original_sections)
        await supabase.from('sections').delete().eq('id', new_section.id)
        await supabase.from('sections').upsert(original_sections)
      }
    })
    update_page_preview()
  },
  move_block: async (block_being_moved, to) => {
    const block_being_replaced = _.find(get(stores.sections), ['index', to])

    const original_sections = cloneDeep(get(stores.sections))
    const updated_sections = swap_array_item_index(get(stores.sections), block_being_moved.index, to).map((section) => {
      if (section.id === block_being_moved.id) {
        return {
          ...section,
          index: to
        }
      } else if (section.id === block_being_replaced?.id) {
        return {
          ...section,
          index: block_being_moved.index
        }
      } else return section
    })

    update_timeline({
      doing: async () => {
        stores.sections.set(updated_sections)
        if (!block_being_replaced) return
        await Promise.all([
          block_being_replaced && supabase.from('sections').update({ index: block_being_moved.index }).eq('id', block_being_replaced.id),
          supabase.from('sections').update({ index: to }).eq('id', block_being_moved.id)
        ])
      },
      undoing: async () => {
        stores.sections.set(original_sections)
        await Promise.all([
          block_being_replaced && supabase.from('sections').update({ index: block_being_replaced.index }).eq('id', block_being_replaced.id),
          supabase.from('sections').update({ index: block_being_moved.index }).eq('id', block_being_moved.id)
        ])
      }
    })
    update_page_preview()
  },
  duplicate_block: async (block, position) => {
    const original_sections = _.cloneDeep(get(stores.sections))

    const new_block = {
      ...block,
      id: uuidv4()
    }

    const new_sections = [
      ...original_sections.slice(0, position),
      new_block,
      ...original_sections.slice(position)
    ].map((section, i) => ({ ...section, index: i }))

    update_timeline({
      doing: async () => {

        const { data, error } = await supabase
          .from('sections')
          .upsert(new_sections.map(s => ({ ...s, symbol: s.symbol.id })))


        stores.sections.set(new_sections)
      },
      undoing: () => {
        stores.sections.set(original_sections)
        supabase.from('sections').delete().eq('id', new_block.id)
      }
    })
    update_page_preview()
  },
  delete_block: async (block) => {
    const original_sections = _.cloneDeep(get(stores.sections))
    const new_sections = original_sections.filter(section => section.id !== block.id).map((section, i) => ({ ...section, index: i }))

    update_timeline({
      doing: async () => {
        stores.sections.set(new_sections)
        await supabase.from('sections').delete().eq('id', block.id)
        await supabase.from('sections').upsert(new_sections.map(s => ({ ...s, symbol: s.symbol.id })))
      },
      undoing: async () => {
        stores.sections.set(original_sections)
        await supabase.from('sections').insert({
          ...block,
          symbol: block.symbol.id
        })
        await supabase.from('sections').upsert(original_sections.map(s => ({ ...s, symbol: s.symbol.id })))
      }
    })
    update_page_preview()
  },
  update: async (obj) => {
    const current_page = _.cloneDeep(get(activePage.default))

    update_timeline({
      doing: async () => {
        activePage.set(obj)
        await supabase.from('pages').update(obj).eq('id', current_page.id)
      },
      undoing: async () => {
        activePage.set(current_page)
        await supabase.from('pages').update(current_page).eq('id', current_page.id)
      }
    })
    update_page_preview()
  },
}

export const pages = {
  create: async (new_page) => {
    const original_pages = cloneDeep(get(stores.pages))

    update_timeline({
      doing: async () => {
        stores.pages.update(store => [...store, new_page])
        await supabase.from('pages').insert({
          ...new_page,
          site: get(unsavedSite)['id']
        }).select().single()
      },
      undoing: async () => {
        stores.pages.set(original_pages)
        await supabase.from('pages').delete().eq('id', new_page.id)
      }
    })
  },
  delete: async (page_id) => {
    const original_pages = cloneDeep(get(stores.pages))
    const updated_pages = original_pages.filter(page => page.id !== page_id && page.parent !== page_id)
    let deleted_sections = []
    let deleted_pages = original_pages.filter(page => page.id === page_id || page.parent === page_id)

    update_timeline({
      doing: async () => {
        stores.pages.set(updated_pages)

        // Delete child pages
        const child_pages = original_pages.filter(page => page.parent === page_id)
        if (child_pages.length > 0) {
          await Promise.all(
            child_pages.map(async page => {
              const { data: sections_to_delete = [] } = await supabase.from('sections').delete().eq('page', page.id).select()
              deleted_sections = sections_to_delete ? [...deleted_sections, ...sections_to_delete] : deleted_sections
              await supabase.from('pages').delete().eq('id', page.id).select()
            })
          ) 
        }

        // Delete page
        const { data: sections_to_delete } = await supabase.from('sections').select('id, page').eq('page', page_id)
        deleted_sections = sections_to_delete ? [...deleted_sections, ...sections_to_delete] : deleted_sections
        await supabase.from('pages').delete().eq('id', page_id)
      },
      undoing: async () => {
        stores.pages.set(original_pages)
        await supabase.from('pages').insert(deleted_pages)
        await supabase.from('sections').insert(deleted_sections)
      }
    })
  },
  update: async (page_id, obj) => {
    const original_page = cloneDeep(get(stores.pages).find(page => page.id === page_id))
    const current_pages = cloneDeep(get(stores.pages))
    const updated_pages = current_pages.map(page => page.id === page_id ? { ...page, ...obj } : page)
    stores.pages.set(updated_pages)
    update_timeline({
      doing: async () => {
        stores.pages.set(updated_pages)
        await supabase.from('pages').update(obj).eq('id', page_id)
      },
      undoing: async () => {
        stores.pages.set(current_pages)
        await supabase.from('pages').update(original_page).eq('id', page_id)
      }
    })
  }
}

export async function update_page_preview(page = get(activePage.default)) {
  const preview = await buildStaticPage({ page, no_js: true })
  if (page.url === 'index') {
    await supabase.storage.from('sites').upload(`${get(stores.site).id}/${page.id}/index.html`, preview, { upsert: true })
    await supabase.storage.from('sites').upload(`${get(stores.site).id}/preview.html`, preview, { upsert: true })
  } else {
    await supabase.storage.from('sites').upload(`${get(stores.site).id}/${page.id}/index.html`, preview, { upsert: true })
  }
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
  const original_sections = _.cloneDeep(get(stores.sections))
  const original_content = _.cloneDeep(section.content)

  // Update static content in symbol
  const original_symbol_content = _.cloneDeep(section.symbol.content)
  const updated_symbol_content = _.cloneDeep(section.symbol.content)
  Object.entries(updated_content).forEach(
    ([locale_key, locale_value]) => {
      Object.entries(locale_value).forEach(([field_key, field_value]) => {
        const matching_field = find(section.symbol.fields, [
          'key',
          field_key,
        ])
        if (matching_field.is_static) {
          updated_symbol_content[locale_key] = {
            ...updated_symbol_content[locale_key],
            [field_key]: field_value,
          }
        }
      })
    }
  )

  update_timeline({
    doing: async () => {
      stores.symbols.update(store => store.map(s => s.id === section.symbol.id ? { ...s, content: updated_symbol_content } : s))
      stores.sections.update(store => store.map(s => s.id === section.id ? { ...s, content: updated_content } : s))
      await Promise.all([
        supabase.from('sections').update({ content: updated_content }).eq('id', section.id),
        supabase.from('symbols').update({ content: updated_symbol_content }).eq('id', section.symbol.id)
      ])
    },
    undoing: async () => {
      stores.symbols.update(store => store.map(s => s.id === section.symbol.id ? { ...s, content: original_symbol_content } : s))
      stores.sections.set(original_sections)
      await Promise.all([
        supabase.from('sections').update({ content: original_content }).eq('id', section.id),
        supabase.from('symbols').update({ content: original_symbol_content }).eq('id', section.symbol.id)
      ])
    }
  })
  update_page_preview()
}

export async function addLocale(key) {
  content.update(s => ({
    ...s,
    [key]: s['en']
  }))
  update_timeline()
}

export async function removeLocale(key) {
  locale.set('en')
  content.update(s => {
    const updatedContent = cloneDeep(s)
    delete updatedContent[key]
    return updatedContent
  })
  update_timeline()
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