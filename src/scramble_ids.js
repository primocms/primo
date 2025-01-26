import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash-es'

export default function scramble_ids({ site, page_types, symbols, pages, sections }) {
  const id_map = new Map()

  function generate_new_id(old_id) {
    if (!old_id) return null
    if (!id_map.has(old_id)) {
      id_map.set(old_id, uuidv4())
    }
  }

  function get_id(old_id) {
    return old_id ? id_map.get(old_id) : null
  }

  // First pass: generate new IDs for all items
  function generate_ids(item) {
    generate_new_id(item.id)
    if (item.fields) {
      item.fields.forEach(field => generate_new_id(field.id))
    }
    if (item.entries) {
      item.entries.forEach(entry => generate_new_id(entry.id))
    }
  }

  [site, ...page_types, ...symbols, ...pages, ...sections].forEach(generate_ids)

  // Second pass: update all references
  function scramble_item(item) {
    const new_item = _.cloneDeep(item)
    new_item.id = get_id(item.id)
    
    if (new_item.fields) {
      new_item.fields = new_item.fields.map(field => scramble_field(field))
    }

    if (new_item.entries) {
      new_item.entries = new_item.entries.map(entry => scramble_entry(entry))
    }
    
    return new_item
  }

  function scramble_page_type(page_type) {
    const new_page_type = scramble_item(page_type)
    new_page_type.site = get_id(page_type.site)
    return new_page_type
  }

  function scramble_page(page) {
    const new_page = scramble_item(page)
    new_page.page_type = get_id(page.page_type)
    new_page.parent = get_id(page.parent)
    return new_page
  }

  function scramble_section(section) {
    const new_section = scramble_item(section)
    new_section.symbol = get_id(section.symbol)
    new_section.palette = get_id(section.palette)
    new_section.master = get_id(section.master)
    new_section.page = get_id(section.page)
    new_section.page_type = get_id(section.page_type)
    return new_section
  }

  function scramble_field(field) {
    const new_field = _.cloneDeep(field)
    new_field.id = get_id(field.id)

    if (new_field.parent) {
      new_field.parent = get_id(new_field.parent)
    }
    if (new_field.options?.source) {
      new_field.options.source = get_id(new_field.options.source)
    }
    if (new_field.options?.page_type) {
      new_field.options.page_type = get_id(new_field.options.page_type)
    }
    if (new_field.source) {
      new_field.source = get_id(new_field.source)
    }
    
    // Add these new references
    new_field.symbol = get_id(field.symbol)
    new_field.page_type = get_id(field.page_type)
    new_field.site = get_id(field.site)
    
    return new_field
  }

  function scramble_entry(entry) {
    const new_entry = _.cloneDeep(entry)
    new_entry.id = get_id(entry.id)
    new_entry.field = get_id(entry.field)
    new_entry.parent = get_id(entry.parent)
    
    if (new_entry.metadata?.page) {
      new_entry.metadata.page = get_id(new_entry.metadata.page)
    }
    
    // Add these new references
    new_entry.page = get_id(entry.page)
    new_entry.page_type = get_id(entry.page_type)
    new_entry.symbol = get_id(entry.symbol)
    new_entry.section = get_id(entry.section)
    new_entry.site = get_id(entry.site)
    
    return new_entry
  }

  function scramble_symbol(symbol) {
    const new_symbol = scramble_item(symbol)
    new_symbol.site = get_id(symbol.site)
    new_symbol.page_types = symbol.page_types.map(get_id)
    return new_symbol
  }

  const new_site = scramble_item(site)
  const new_page_types = page_types.map(scramble_page_type)
  const new_symbols = symbols.map(scramble_symbol)
  const new_pages = pages.map(scramble_page)
  const new_sections = sections.map(scramble_section)

  return {
    site: new_site,
    page_types: new_page_types,
    symbols: new_symbols,
    pages: new_pages,
    sections: new_sections
  }
}
