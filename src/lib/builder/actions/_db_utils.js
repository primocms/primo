import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash-es'
import * as helpers from './_helpers'

export function sort_by_hierarchy(items, dependency = 'parent') {
  const item_map = new Map(items.map(entry => [entry.id, entry]))
  const sorted = []
  const visited = new Set()
  const temp_visited = new Set()

  function dfs(item_id) {
    if (temp_visited.has(item_id)) {
      throw new Error('Circular dependency detected')
    }
    if (visited.has(item_id)) return

    temp_visited.add(item_id)
    const item = item_map.get(item_id)
    
    if (item[dependency] && item_map.has(item[dependency])) {
      dfs(item[dependency])
    }

    temp_visited.delete(item_id)
    visited.add(item_id)
    sorted.push(item)
  }

  for (const item of items) {
    if (!visited.has(item.id)) {
      dfs(item.id)
    }
  }

  return sorted
}

export function remap_entry_ids(entries, return_map = false) {
  const id_map = {}

  function generate_new_id(item) {
    id_map[item.id] = uuidv4()
  }

  function get_id(old_id) {
    return id_map[old_id] || old_id
  }

  // First pass: generate new IDs for all items
  entries.forEach(generate_new_id)

  function remap_entry(entry) {
    const new_entry = _.cloneDeep(entry)
    new_entry.id = get_id(entry.id)
    new_entry.parent = get_id(entry.parent)
    return new_entry
  }

  // Second pass: update all references
  const new_entries = entries.map(remap_entry)

  return return_map ? [ new_entries, id_map ] : new_entries
}

export function remap_ids({ pages, sections }) {
  const id_map = new Map()

  function generate_new_id(old_id) {
    if (!old_id) return null
    if (!id_map.has(old_id)) {
      id_map.set(old_id, uuidv4())
    }
    return id_map.get(old_id)
  }

  function get_id(old_id) {
    return id_map.get(old_id) || old_id
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

  // [site, ...page_types, ...symbols, ...pages, ...sections].forEach(generate_ids)
  [...pages, ...sections].forEach(generate_ids)

  // Second pass: update all references
  function scramble_item(item) {
    const new_item = _.cloneDeep(item)
    new_item.id = get_id(item.id)
    
    // if (new_item.fields) {
    //   new_item.fields = new_item.fields.map(field => scramble_field(field))
    // }

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

  // function scramble_field(field) {
  //   const new_field = _.cloneDeep(field)
  //   new_field.id = get_id(field.id)

  //   if (new_field.parent) {
  //     new_field.parent = get_id(new_field.parent)
  //   }
  //   if (new_field.options?.source) {
  //     new_field.options.source = get_id(new_field.options.source)
  //   }
  //   if (new_field.options?.page_type) {
  //     new_field.options.page_type = get_id(new_field.options.page_type)
  //   }
  //   if (new_field.source) {
  //     new_field.source = get_id(new_field.source)
  //   }
    
  //   // Add these new references
  //   new_field.symbol = get_id(field.symbol)
  //   new_field.page_type = get_id(field.page_type)
  //   new_field.site = get_id(field.site)
    
  //   return new_field
  // }

  function scramble_entry(entry) {
    const new_entry = _.cloneDeep(entry)
    new_entry.id = get_id(entry.id)
    // new_entry.field = get_id(entry.field)
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

  // const new_site = scramble_item(site)
  // const new_page_types = page_types.map(scramble_page_type)
  // const new_symbols = symbols.map(scramble_symbol)
  const new_pages = pages.map(scramble_page)
  const new_sections = sections.map(scramble_section)

  return {
    // site: new_site,
    // page_types: new_page_types,
    // symbols: new_symbols,
    pages: new_pages,
    sections: new_sections,
    _map: id_map
  }
}






export function generate_inverted_content([ field_changes, original_fields ], entry_list) {
	const restored_fields = _.cloneDeep(original_fields)

	const insertions = []
	const updates = []
	const deletions = []

	for (const change of field_changes) {
		if (change.action === 'insert') {
			deletions.push({
				id: change.id
			})
		} else if (change.action === 'update') {
			const original_field = original_fields.find((f) => f.id === change.id)
			const original_field_properties = _.pick(original_field, _.keys(change.data))
			updates.push({
				id: change.id,
				data: original_field_properties
			})
		} else if (change.action === 'delete') {
			const original_field = original_fields.find((f) => f.id === change.id)
			insertions.push({ ...original_field })
		}
	}

	// remap insertion IDs
	const [remapped_insertions, field_id_map] = remap_entry_ids(insertions, true)

	// remap ID on restored field
	for (const insertion of insertions) {
		const new_id = field_id_map[insertion.id]
    const parent = field_id_map[insertion.parent] || insertion.parent

    const field = _.find(restored_fields, ['id', insertion.id])
		field.id = new_id
    field.parent = parent
	}

	const inverted_field_changes = [
		...sort_by_hierarchy(remapped_insertions).map(item => ({
			action: 'insert',
			data: item
		})),
		...updates.map(item => ({
			action: 'update',
			id: item.id,
			data: item.data
		})),
		...deletions.map(item => ({
			action: 'delete',
			id: item.id
		}))
	]

  // handle entries
  const inverted_entry_changes = []
  const restored_entries = []
  for (const [ changes, entries ] of entry_list) {
    const original_entries = _.cloneDeep(entries)

    const insertions = []
    const updates = []
    const deletions = []
  
    for (const change of changes) {
      if (change.action === 'insert') {
        deletions.push({
          id: change.id
        })
      } else if (change.action === 'update') {
        const original_entry = entries.find((f) => f.id === change.id)
        const original_entry_properties = _.pick(original_entry, _.keys(change.data))
        updates.push({
          id: change.id,
          data: original_entry_properties
        })
      } else if (change.action === 'delete') {
        const original_entry = entries.find((f) => f.id === change.id)
        insertions.push({ ...original_entry })
      }
    }

    // remap insertion IDs
    const [remapped_insertions, id_map] = remap_entry_ids(insertions, true)

    // remap ID on restored field
    for (const insertion of insertions) {
      const new_id = id_map[insertion.id]
      const parent = id_map[insertion.parent] || insertion.parent
      const field = field_id_map[insertion.field] || insertion.field

      const entry = _.find(original_entries, ['id', insertion.id])
      entry.id = new_id
      entry.parent = parent
      entry.field = field
    }

    inverted_entry_changes.push([
      ...sort_by_hierarchy(remapped_insertions).map(item => ({
        action: 'insert',
        data: item
      })),
      ...updates.map(item => ({
        action: 'update',
        id: item.id,
        data: item.data
      })),
      ...deletions.map(item => ({
        action: 'delete',
        id: item.id
      }))
    ])

    restored_entries.push(original_entries)
  }

  return {
    changes: {
      fields: inverted_field_changes,
      entries: inverted_entry_changes
    },
    items: {
      fields: restored_fields,
      entries: restored_entries
    }
  }

	// return [ inverted_changes, restored_fields ]
}


export function generate_inverted_field_changes(changes, original_fields) {
	const restored_fields = _.cloneDeep(original_fields)

	let insertions = []
	const updates = []
	const deletions = []

	for (const change of changes) {
		if (change.action === 'insert') {
			deletions.push({
				id: change.id
			})
		} else if (change.action === 'update') {
			const original_field = original_fields.find((f) => f.id === change.id)
			const original_field_properties = _.pick(original_field, _.keys(change.data))
			updates.push({
				id: change.id,
				data: original_field_properties
			})
		} else if (change.action === 'delete') {
			const original_field = original_fields.find((f) => f.id === change.id)
			insertions.push(original_field)
		}
	}

	// remap insertion IDs
	const [remapped_insertions, id_map] = remap_entry_ids(insertions, true)

	// remap ID on restored field
	for (const insertion of insertions) {
		const new_id = id_map[insertion.id]
		_.find(restored_fields, ['id', insertion.id]).id = new_id
	}

	const inverted_changes = [
		...sort_by_hierarchy(remapped_insertions).map(item => ({
			action: 'insert',
			data: item
		})),
		...updates.map(item => ({
			action: 'update',
			id: item.id,
			data: item.data
		})),
		...deletions.map(item => ({
			action: 'delete',
			id: item.id
		}))
	]

  return {
    changes: inverted_changes,
    fields: restored_fields,
    map: id_map
  }
}


export function generate_inverted_entry_changes(changes, original_entries, field_map) {
	const restored_entries = _.cloneDeep(original_entries)

	let insertions = []
	const updates = []
	const deletions = []

	for (const change of changes) {
		if (change.action === 'insert') {
			deletions.push({
				id: change.id
			})
		} else if (change.action === 'update') {
			const original_entry = original_entries.find((f) => f.id === change.id)
			const original_entry_properties = _.pick(original_entry, _.keys(change.data))
			updates.push({
				id: change.id,
				data: original_entry_properties
			})
		} else if (change.action === 'delete') {
			const original_entry = original_entries.find((f) => f.id === change.id)
			insertions.push(original_entry)
		}
	}

	// remap insertion IDs
	const [remapped_insertions, id_map] = remap_entry_ids(insertions, true)

	// remap ID on restored field
	for (const insertion of insertions) {
		const new_id = id_map[insertion.id]
		_.find(restored_entries, ['id', insertion.id]).id = new_id
	}

	const inverted_changes = [
		...sort_by_hierarchy(remapped_insertions).map(item => ({
			action: 'insert',
			data: item
		})),
		...updates.map(item => ({
			action: 'update',
			id: item.id,
			data: item.data
		})),
		...deletions.map(item => ({
			action: 'delete',
			id: item.id
		}))
	]



	return {
    changes: helpers.update_entry_changes_with_new_field_ids(inverted_changes, field_map), 
    entries: helpers.update_entries_with_new_field_ids(restored_entries, field_map) 
  }
}





export function generate_inverted_changes(changes, original_items) {
	const restored_fields = _.cloneDeep(original_items)

	let insertions = []
	const updates = []
	const deletions = []

	for (const change of changes) {
		if (change.action === 'insert') {
			deletions.push({
				id: change.id
			})
		} else if (change.action === 'update') {
			const original_field = original_items.find((f) => f.id === change.id)
			const original_field_properties = _.pick(original_field, _.keys(change.data))
			updates.push({
				id: change.id,
				data: original_field_properties
			})
		} else if (change.action === 'delete') {
			const original_field = original_items.find((f) => f.id === change.id)
			insertions.push(original_field)
		}
	}

	// remap insertion IDs
	const [remapped_insertions, id_map] = remap_entry_ids(insertions, true)

	// remap ID on restored field
	for (const insertion of insertions) {
		const new_id = id_map[insertion.id]
		_.find(restored_fields, ['id', insertion.id]).id = new_id
	}

	const inverted_changes = [
		...sort_by_hierarchy(remapped_insertions).map(item => ({
			action: 'insert',
			data: item
		})),
		...updates.map(item => ({
			action: 'update',
			id: item.id,
			data: item.data
		})),
		...deletions.map(item => ({
			action: 'delete',
			id: item.id
		}))
	]

	return [ inverted_changes, restored_fields ]
}



export function remap_content(entries, fields) {
  // loop through changes
  // for inserted items, remap ID and remap ID on matching entry

  const remapped_entries = _.cloneDeep(entries)
  const remapped_fields = _.cloneDeep(fields)

  const field_map = remap_entry_ids(remapped_fields, true)[1]

  for (const unmapped_field of remapped_fields) {
    const new_id = field_map[unmapped_field.id]
    const new_parent_id = field_map[unmapped_field.parent] || unmapped_field.parent

    const field = _.find(remapped_fields, ['id', unmapped_field.id])
    field.id = new_id
    field.parent = new_parent_id
    entries
      .filter(entry => entry.field === unmapped_field.id)
      .forEach(entry => entry.field = new_id)
  } 

  const entry_map = remap_entry_ids(remapped_entries, true)[1]
  for (const unmapped_entry of remapped_entries) {
    const new_id = entry_map[unmapped_entry.id]
    const new_parent_id = entry_map[unmapped_entry.parent] || unmapped_entry.parent
    const new_field_id = field_map[unmapped_entry.field] || unmapped_entry.field

    const entry = _.find(remapped_entries, ['id', unmapped_entry.id])
    entry.id = new_id
    entry.parent = new_parent_id
    entry.field = new_field_id
  } 
  return {
    entries: remapped_entries,
    fields: remapped_fields
  }
}


export function remap_entries_and_fields({changes, items}) {
  // loop through changes
  // for inserted items, remap ID and remap ID on matching entry

  const fields_to_remap = _.cloneDeep(changes.fields.filter(c => c.action === 'insert').map(c => c.data))
  const field_map = remap_entry_ids(fields_to_remap, true)[1]

  for (const unmapped_field of fields_to_remap) {
    const new_id = field_map[unmapped_field.id]
    const new_parent_id = field_map[unmapped_field.parent] || unmapped_field.parent

    const change = _.find(changes.fields, ['id', unmapped_field.id])
    change.id = new_id 
    change.data.id = new_id
    change.data.parent = new_parent_id

    changes.entries
      .filter(change => change.data.field === unmapped_field.id)
      .forEach(change => change.data.field = new_id)

    const field = _.find(items.fields, ['id', unmapped_field.id])
    field.id = new_id
    field.parent = new_parent_id
    items.entries
      .filter(entry => entry.field === unmapped_field.id)
      .forEach(entry => entry.field = new_id)
  } 

  const entries_to_remap = _.cloneDeep(changes.entries.filter(c => c.action === 'insert').map(c => c.data))
  const entry_map = remap_entry_ids(entries_to_remap, true)[1]

  for (const unmapped_entry of entries_to_remap) {
    const new_id = entry_map[unmapped_entry.id]
    const new_parent_id = entry_map[unmapped_entry.parent] || unmapped_entry.parent

    const change = _.find(changes.entries, ['id', unmapped_entry.id])
    change.id = new_id 
    change.data.id = new_id
    change.data.parent = new_parent_id

    const entry = _.find(items.entries, ['id', unmapped_entry.id])
    entry.id = new_id
    entry.parent = new_parent_id
  } 
}