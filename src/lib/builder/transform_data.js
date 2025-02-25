import _ from 'lodash-es'
import * as factories from './factories.js'

export function transform_fields({ fields }) {
	if (!fields) return []

	let transformed_fields = []
	let count = 0
	let done = new Set() // track transformed field IDs for reference

	while (done.size < fields.length && count < 99999) {
		for (const field of fields) {
			// already done, skip
			if (done.has(field.id)) continue

			// root level, add
			if (!field.parent) {
				// add root property/object for nested entries
				transformed_fields.push({ ...factories.Field(field), id: field.id })
				done.add(field.id)
				continue
			}

			// parent exists, add to parent
			if (done.has(field.parent)) {
				const parent_field = deep_find(transformed_fields, 'fields', ['id', field.parent])
				parent_field.fields.push({ ...factories.Field(field), id: field.id })
				done.add(field.id)
				continue
			}
			count++
		}
	}
	count++

	return transformed_fields
}

export function transform_content({ fields, entries }) {
	if (!entries) return { en: {} }
	// console.log('transform_content', { fields, entries })

	// initialize and set locales
	let structured_entries = { en: {} }
	entries.forEach((row) => {
		if (row.locale) {
			structured_entries[row.locale] = {}
		}
	})

	function get_parent_node(parent_content_id, append_path = '') {
		// item is at root level
		if (!parent_content_id) {
			return _.get(structured_entries, `['en']`)
		}

		const parent_entries = entries.find((i) => i.id === parent_content_id)
		const parent_field = fields.find((f) => f.id === parent_entries.field)

		// parent is at root level
		if (!parent_entries.parent) {
			return _.get(structured_entries, `['en']['${parent_field.key}']${append_path}`)
		}

		// parent is repeater or group container
		if (parent_field) {
			return get_parent_node(parent_entries.parent, `['${parent_field.key}']` + append_path)
		}

		// parent is repeater item
		if (parent_entries.index !== null) {
			return get_parent_node(parent_entries.parent, `[${parent_entries.index}]` + append_path)
		}
	}

	let count = 0
	try {
		let done = new Set() // track transformed entries for reference

		// then, set all entries values
		while (done.size < entries.length && count < 999) {
			for (const entry of entries) {
				// skip if item already added
				if (done.has(entry.id)) continue

				// skip if has parent and parent hasn't been added yet
				if (entry.parent && !done.has(entry.parent)) {
					continue
				}

				// get matching field to use key
				const field = fields.find((f) => f.id === entry.field)

				const parent_node = get_parent_node(entry.parent)

				// initialize repeater container
				if (field?.type === 'repeater') {
					if (!parent_node) {
						debugger
					}
					parent_node[field.key] = []
					done.add(entry.id)
					continue
				}

				// initialize repeater item
				if (!entry.field) {
					if (!parent_node) {
						debugger
					}
					parent_node[entry.index] = {}
					done.add(entry.id)
					continue
				}

				if (!field) {
					debugger
				}

				// initialize group container
				if (field.type === 'group') {
					parent_node[field.key] = {}
					done.add(entry.id)
					continue
				}

				// set value item
				parent_node[field.key] = entry.value
				done.add(entry.id)
			}

			count++
		}
		const finished = Array.from(done.values())
		const looking = entries.filter((r) => !finished.includes(r.id))
		if (looking.length > 0) {
			console.error('ERROR', { looking, entries, fields, structured_entries })
			debugger
		}
	} catch (e) {
		console.error(e, { entries, fields })
		structured_entries = null
	}
	return structured_entries
}

function deep_find(array, child_key, [key, value]) {
	let found = null
	for (const obj of array) {
		if (obj[key] === value) {
			found = obj
			break
		}
		const child = deep_find(obj[child_key], child_key, [key, value])
		if (child) {
			found = child
		}
	}
	return found
}
