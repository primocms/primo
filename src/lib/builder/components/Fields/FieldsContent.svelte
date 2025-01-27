<script>
	import { createEventDispatcher } from 'svelte'
	import Icon from '@iconify/svelte'
	import _, { cloneDeep, chain as _chain, set as _set, get as _get, isRegExp as _isRegExp } from 'lodash-es'
	import { Field_Row, Content_Row } from '../../factories.js'
	import FieldItem from './FieldItem.svelte'
	import active_page from '../../stores/data/page.js'
	import page_type from '../../stores/data/page_type.js'
	import site from '../../stores/data/site.js'
	import { fieldTypes, locale } from '../../stores/app/index.js'
	import { is_regex, get_empty_value } from '../../utils.js'
	import Card from '../../ui/Card.svelte'
	import { get, set } from 'idb-keyval'
	import { userRole, mod_key_held } from '../../stores/app/misc'
	import { dynamic_field_types } from '../../field-types'

	let { id, fields, fields_changes = [], entries, content_changes = $bindable([]), onkeydown = () => {} } = $props()

	let parent_fields = $derived(fields.filter((f) => !f.parent))

	const dispatch = createEventDispatcher()

	function get_field_ancestors(field) {
		const parent = fields.find((f) => f.id === field.parent)
		return parent ? [parent.id, ...get_field_ancestors(parent)] : []
	}

	function create_field() {
		const new_field = Field_Row({ index: parent_fields.length })
		const updated_fields = cloneDeep([...fields, new_field])

		const new_content_entry = Content_Row({
			field: new_field.id,
			locale: $locale,
			value: get_empty_value(new_field)
		})
		const updated_entries = cloneDeep([...entries, new_content_entry])
		dispatch_update({
			entries: updated_entries,
			content_changes: [{ action: 'insert', id: new_content_entry.id, data: new_content_entry }],
			fields: updated_fields,
			fields_changes: [{ action: 'insert', id: new_field.id, data: new_field }]
		})
		add_tab(new_field.id)
	}

	function create_subfield(parent_field) {
		const number_of_sibling_subfields = fields.filter((f) => f.parent === parent_field.id).length
		const new_field = Field_Row({ parent: parent_field.id, index: number_of_sibling_subfields })
		const updated_fields = cloneDeep([...fields, new_field])

		// create entries entries
		const new_entries = []
		const parent_container_entry = entries.find((e) => e.field === parent_field.id)
		if (parent_field.type === 'repeater' && parent_container_entry) {
			// add entries item for each existing repeater item
			const repeater_item_entries = entries.filter((e) => e.parent === parent_container_entry.id)
			for (const repeater_item_entry of repeater_item_entries) {
				const new_entry = Content_Row({
					parent: repeater_item_entry.id,
					field: new_field.id,
					value: get_empty_value(new_field),
					locale: ['repeater', 'group'].includes(new_field.type) ? null : $locale
				})
				new_entries.push(new_entry)
			}
		} else if (parent_field.type === 'group' && parent_container_entry) {
			const new_entry = Content_Row({
				parent: parent_container_entry.id,
				field: new_field.id,
				value: get_empty_value(new_field),
				locale: ['repeater', 'group'].includes(new_field.type) ? null : $locale
			})
			new_entries.push(new_entry)
		}
		const updated_entries = cloneDeep([...entries, ...new_entries])

		dispatch_update({
			fields: updated_fields,
			fields_changes: [{ action: 'insert', id: new_field.id, data: new_field }],
			entries: updated_entries,
			content_changes: new_entries.map((entry) => ({ action: 'insert', id: entry.id, data: entry }))
		})
	}

	function delete_field(field) {
		const deleted_fields = []
		const updated_fields = cloneDeep(
			fields.filter((f) => {
				// root-level & not a match
				if (!f.parent && f.id !== field.id) {
					return true
				}
				// field matches
				if (f.id === field.id) {
					deleted_fields.push(field)
					return false
				}
				// is descendent of field
				if (get_field_ancestors(f).includes(field.id)) {
					deleted_fields.push(f)
					return false
				}
				return true
			})
		)

		// update sibling indeces
		const updated_siblings = updated_fields
			.filter((f) => f.parent === field.parent)
			.sort((a, b) => a.index - b.index)
			.map((f, i) => ({ ...f, index: i }))
		for (const sibling of updated_siblings) {
			const field = updated_fields.find((f) => f.id === sibling.id)
			field.index = sibling.index
		}

		// delete unused entries
		// don't need this because deleting field will cascade delete the entries
		// nvm, useful when undoing delete operations. unnecessary db operation but that can be filtered out later.

		const deleted_entries = []
		const updated_entries = cloneDeep(
			entries.filter((entry) => {
				if (entry.site || entry.page) return true // don't touch page/site entries
				const parent_container = entries.find((e) => e.id === entry.parent)
				const field_still_exists = entry.field
					? updated_fields.some((f) => f.id === entry.field) // value entry & container
					: updated_fields.some((f) => f.id === parent_container.field) // repeater entry
				if (!field_still_exists) {
					deleted_entries.push(entry)
				}
				return field_still_exists
			})
		)

		dispatch_update({
			fields: updated_fields,
			fields_changes: [
				...deleted_fields.map((field) => ({ action: 'delete', id: field.id })),
				...updated_siblings.map((sibling) => ({
					action: 'update',
					id: sibling.id,
					data: { index: sibling.index }
				}))
			],
			entries: updated_entries,
			content_changes: deleted_entries.map((entry) => ({ action: 'delete', id: entry.id }))
		})
	}

	function duplicate_field(field) {
		const updated_fields = cloneDeep(fields)
		const updated_field_ids = {}

		// add duplicate field
		const new_field = Field_Row({
			...field,
			key: field.key + '_copy',
			label: field.label + ' copy'
		})
		updated_fields.push(new_field)
		updated_field_ids[field.id] = new_field.id

		// set updated indeces
		const siblings_and_self = updated_fields
			.filter((f) => f.parent === field.parent)
			.sort((a, b) => a.index - b.index)
			.map((f, i) => ({ ...f, index: i }))
		for (const child of siblings_and_self) {
			const field = updated_fields.find((f) => f.id === child.id)
			field.index = child.index
		}

		// clone descendent fields & update IDs
		const descendent_fields = fields
			.filter((f) => get_field_ancestors(f).includes(field.id))
			.map((f) => {
				const new_field = Field_Row(f)
				updated_field_ids[f.id] = new_field.id
				return new_field
			}) // get new IDs

		for (const descendent of descendent_fields) {
			descendent.parent = updated_field_ids[descendent.parent]
		}
		updated_fields.push(...descendent_fields)

		const original_entries = entries.filter((e) => e.field === field.id)
		const new_entries = original_entries.map((entry) =>
			Content_Row({
				...entry,
				field: updated_field_ids[entry.field]
			})
		)
		const updated_entries = cloneDeep([...entries, ...new_entries])

		dispatch_update({
			fields: updated_fields,
			fields_changes: [
				{ action: 'insert', id: new_field.id, data: new_field },
				...siblings_and_self.map((field) => ({
					action: 'update',
					id: field.id,
					data: { index: field.index }
				})),
				...descendent_fields.map((field) => ({
					action: 'insert',
					id: field.id,
					data: field
				}))
			],
			entries: updated_entries,
			content_changes: new_entries.map((entry) => ({
				action: 'insert',
				id: entry.id,
				data: entry
			}))
		})
	}

	function move_field({ field, direction }) {
		const updated_fields = cloneDeep(fields)

		// select siblings (could be root level)
		const siblings = updated_fields.filter((f) => f.parent === field.parent && f.id !== field.id).sort((a, b) => a.index - b.index)

		// update siblings & self w/ new indeces
		const updated_children = {
			up: [...siblings.slice(0, field.index - 1), field, ...siblings.slice(field.index - 1)],
			down: [...siblings.slice(0, field.index + 1), field, ...siblings.slice(field.index + 1)]
		}[direction].map((f, i) => ({ ...f, index: i }))

		// set updated_fields w/ updated indeces
		for (const child of updated_children) {
			const field = updated_fields.find((f) => f.id === child.id)
			field.index = child.index
		}
		dispatch_update({
			fields: updated_fields,
			fields_changes: updated_children.map((child) => ({
				action: 'update',
				id: child.id,
				data: { index: child.index }
			})),
			entries,
			content_changes
		})
	}

	function update_field({ id, data }) {
		// TODO: ensure only passing updated properties
		const updated_field = cloneDeep({ ...fields.find((f) => f.id === id), ...data })
		let updated_fields = cloneDeep(fields)
		const existing_field = fields.find((f) => f.id === id)

		const inserted_fields = []
		const updated_field_rows = []
		const deleted_fields = []

		let updated_entries = _.cloneDeep(entries)
		const field_content_entries = updated_entries.filter((e) => e.field === id)

		const inserted_entries = []
		const changed_entries = []
		const deleted_entries = []

		const changing_field_to_dynamic_type = !['page-field', 'site-field'].includes(existing_field.type) && ['page-field', 'site-field'].includes(updated_field.type)

		if (existing_field.type !== updated_field.type) {
			// set initial source when changing to dynamic field type
			const page_type_fields = [...$active_page.page_type.fields, ...$page_type.fields]
			if (changing_field_to_dynamic_type) {
				const initial_source_field =
					updated_field.type === 'page-field' ? page_type_fields.filter((f) => !f.parent)[0] : updated_field.type === 'site-field' ? $site.fields.filter((f) => !f.parent)[0] : null
				updated_field.source = initial_source_field?.id
			}

			// type has changed, reset entry values to new type & remove children
			updated_fields = cloneDeep(fields.map((f) => (f.id === updated_field.id ? updated_field : f)))
			updated_field_rows.push({ id, data: updated_field })

			// override entry values w/ values compatible w/ new field type
			for (const entry of field_content_entries) {
				const updated_entry_value = get_empty_value(updated_field)
				changed_entries.push({ id: entry.id, data: { value: updated_entry_value } })
				updated_entries = updated_entries.map((e) => (e.id === entry.id ? { ...entry, value: updated_entry_value } : e))
			}

			// delete any child fields & corresponding entries
			// TODO: what if the new type is a group/repeater? do we need to create entries?
			if (existing_field.type === 'group' || existing_field.type === 'repeater') {
				updated_fields = updated_fields.filter((field) => {
					if (get_field_ancestors(field).includes(updated_field.id)) {
						deleted_fields.push(field)
						return false
					} else return true
				})

				// delete any child entries entries

				updated_entries = updated_entries.filter((entry) => {
					const parent_container = entries.find((e) => e.id === entry.parent)
					const entry_field_deleted = entry.field
						? deleted_fields.some((f) => f.id === entry.field) // value entry & container
						: deleted_fields.some((f) => f.id === parent_container.field) // repeater entry
					const is_child_repeater_entry = parent_container?.field === updated_field.id
					if (entry_field_deleted || is_child_repeater_entry) {
						deleted_entries.push(entry)
						return false
					}
					return true
				})
			}
		} else {
			updated_fields = cloneDeep(fields.map((f) => (f.id === updated_field.id ? updated_field : f)))
			updated_field_rows.push({ id, data })
		}

		dispatch_update({
			fields: updated_fields,
			fields_changes: [
				...inserted_fields.map((field) => ({ action: 'insert', id: field.id, data: field })),
				...updated_field_rows.map(({ id, data }) => ({ action: 'update', id, data })),
				...deleted_fields.map((field) => ({ action: 'delete', id: field.id, data: field }))
			],
			entries: updated_entries,
			content_changes: [
				...inserted_entries.map((entry) => ({ action: 'insert', id: entry.id, data: entry })),
				...changed_entries.map(({ id, data }) => ({ action: 'update', id, data })),
				...deleted_entries.map((entry) => ({ action: 'delete', id: entry.id, data: entry }))
			]
		})
	}

	function validate_fields_changes(new_changes = []) {
		let validated_changes = _.cloneDeep(fields_changes)

		if (new_changes.length === 0) {
			return validated_changes
		}

		for (const change of new_changes) {
			const { action, id, data } = change
			const previous_change_on_same_item = validated_changes.find((c) => c.id === change.id)

			if (!previous_change_on_same_item) {
				validated_changes = [...validated_changes, { action, id, data }]
				continue
			}

			const { id: previous_id, action: previous_action, data: previous_data } = previous_change_on_same_item

			if (action === 'update' && previous_action === 'insert') {
				previous_change_on_same_item.data = { ...previous_data, ...data }
				continue
			}

			if (action === 'update') {
				previous_change_on_same_item.data = { ...previous_data, ...data }
				continue
			}

			if (action === 'delete') {
				// remove changes on this field
				validated_changes = validated_changes.filter((c) => c.id !== previous_id)

				// add delete change for db-existing field
				if (previous_action === 'update') {
					validated_changes.push({ action, id, data })
				}

				// remove insert/update changes on field entries
				content_changes = content_changes.filter((content_change) => {
					if (change.action === 'delete') return true

					const entry = entries.find((e) => e.id === content_change.id)

					// remove insert/updates on entry
					if (entry.field === change.id) return false

					// remove insert/updates on entry descendents
					if (get_entry_ancestors(entry).some((e) => e.field === change.id)) {
						return false
					}

					return true
				})
			}
		}
		return validated_changes
	}

	function validate_content_changes(new_changes = []) {
		let validated_changes = _.cloneDeep(content_changes)

		if (new_changes.length === 0) {
			return validated_changes
		}

		for (const change of new_changes) {
			const previous_change_on_same_item = validated_changes.find((c) => c.id === change.id)

			if (!previous_change_on_same_item) {
				validated_changes = [...validated_changes, change]
				continue
			}

			const { action: previous_action, data: previous_data } = previous_change_on_same_item

			if (change.action === 'update' && previous_action === 'insert') {
				previous_change_on_same_item.data = { ...previous_data, ...change.data }
				continue
			}

			if (change.action === 'update') {
				previous_change_on_same_item.data = { ...previous_data, ...change.data }
				continue
			}

			if (change.action === 'delete') {
				validated_changes = validated_changes.filter((existing_change) => {
					// remove insert/updates on entry
					if (existing_change.id === change.id) return false

					// remove insert/updates on entry descendents
					const entry = entries.find((e) => e.id === existing_change.id)
					if (!entry) return false // corrupted entry
					if (get_entry_ancestors(entry).some((e) => e.id === change.id)) {
						return false
					}

					return true
				})
			}
		}
		return validated_changes
	}

	function dispatch_update(update) {
		dispatch('input', {
			fields: update.fields || fields,
			entries: update.entries || entries,
			changes: {
				fields: validate_fields_changes(update.fields_changes),
				entries: validate_content_changes(update.content_changes)
			}
		})
	}

	function get_entry_ancestors(entry) {
		const parent = entries.find((e) => e.id === entry.parent)
		return parent ? [parent, ...get_entry_ancestors(parent)] : []
	}

	function get_component(field) {
		const fieldType = $fieldTypes.find((ft) => ft.id === field.type)
		if (fieldType) {
			return fieldType.component
		} else {
			console.warn(`Field type '${field.type}' no longer exists, removing '${field.label}' field`)
			return null
		}
	}

	function check_condition(field) {
		if (!field.options.condition) return true // has no condition

		const comparable_fields = fields.filter((f) => f.parent === field.parent && f.id !== field.id && f.index < field.index && !f.options.condition)
		const { field: field_to_check_id, value, comparison } = field.options.condition
		const field_to_check = comparable_fields.find((f) => f.id === field_to_check_id)
		if (!field_to_check) {
			return false
		}

		// TODO: ensure correct field (considering repeaters)
		const content_entry = get_content_entry(field_to_check)
		const comparable_value = content_entry.value !== undefined ? content_entry.value : null
		if (comparable_value === null) {
			// comparable entry is a non-matching data field
			// TODO: add UI to conditional component that says "this field will show when data field is irrelevant"
			return true
		} else if (comparison === '=' && value === comparable_value) {
			return true
		} else if (comparison === '!=' && value !== comparable_value) {
			return true
		} else if (is_regex(value)) {
			const regex = new RegExp(value.slice(1, -1))
			if (comparison === '=' && regex.test(comparable_value)) {
				return true
			} else if (comparison === '!=' && !regex.test(comparable_value)) {
				return true
			}
		}
		return false
	}

	function add_repeater_item({ parent, index, subfields, dynamic = null }) {
		const relation = dynamic === 'site' ? { site: $site.id } : dynamic === 'page' ? { page: $active_page.id } : {}
		const parent_container = entries.find((e) => e.id === parent)
		const new_repeater_item = Content_Row({ parent: parent_container.id, index, ...relation })
		const new_entries = subfields.flatMap((subfield) => {
			const new_entry = Content_Row({
				parent: new_repeater_item.id,
				field: subfield.id,
				value: get_empty_value(subfield),
				locale: subfield.type === 'repeater' || subfield.type === 'group' ? null : $locale,
				...relation
			})
			// if subfield is a group, add entries for *its* subfields
			// TODO: (recursively)
			if (subfield.type === 'group') {
				const grandchild_fields = fields.filter((f) => f.parent === subfield.id)
				const group_child_entries = grandchild_fields.map((grandchild_field) =>
					Content_Row({
						parent: new_entry.id,
						field: grandchild_field.id,
						value: get_empty_value(grandchild_field),
						locale: grandchild_field.type === 'repeater' || grandchild_field.type === 'group' ? null : $locale,
						...relation
					})
				)
				return [new_entry, ...group_child_entries]
			}

			return new_entry
		})
		const new_rows = [new_repeater_item, ...new_entries]
		const updated_entries = cloneDeep([...entries, ...new_rows])
		dispatch_update({
			entries: updated_entries,
			content_changes: new_rows.map((row) => ({ action: 'insert', id: row.id, data: row, dynamic }))
		})
	}

	function remove_repeater_item(item, dynamic = null) {
		let updated_entries = cloneDeep(entries.filter((c) => c.id !== item.id)) // remove repeater item entry

		// get siblings, update indeces
		const siblings = updated_entries
			.filter((c) => c.parent === item.parent)
			.sort((a, b) => a.index - b.index)
			.map((c, i) => ({ ...c, index: i }))
		for (const sibling of siblings) {
			const entry = updated_entries.find((c) => c.id === sibling.id)
			entry.index = sibling.index
		}

		// remove descendents
		updated_entries = updated_entries.filter((entry) => {
			const is_descendent = get_entry_ancestors(entry).some((e) => e.id === item.id)
			if (is_descendent) {
				return false
			} else return true
		})

		dispatch_update({
			entries: updated_entries,
			content_changes: [
				{ action: 'delete', id: item.id, dynamic },
				...siblings.map((child) => ({
					action: 'update',
					id: child.id,
					data: { index: child.index }
				}))
			]
		})
	}

	function move_repeater_item({ item, new_index }) {
		const updated_entries = cloneDeep(entries)

		// select siblings (could be root level)
		const siblings = updated_entries.filter((c) => c.parent === item.parent && c.id !== item.id).sort((a, b) => a.index - b.index)

		// update siblings & self w/ new indeces
		const updated_children = [...siblings.slice(0, new_index), item, ...siblings.slice(new_index)].map((f, i) => ({ ...f, index: i }))

		// set updated_entries w/ updated indeces
		for (const child of updated_children) {
			const row = updated_entries.find((c) => c.id === child.id)
			row.index = child.index
		}
		dispatch_update({
			entries: updated_entries,
			content_changes: updated_children.map((child) => ({
				action: 'update',
				id: child.id,
				data: { index: child.index }
			}))
		})
	}

	function get_content_entry(field) {
		if (![dynamic_field_types].includes(field.type)) return entries.find((e) => e.field === field.id)
		const source_entry = $active_page.entries.find((e) => e.field === field.source) || $page_type.entries.find((e) => e.field === field.source) || $site.entries.find((e) => e.field === field.source)
		return source_entry
	}

	// TABS
	const selected_tabs = $state(Object.fromEntries(fields.filter((f) => !f.parent).map((f) => [f.id, 'entry'])))
	function add_tab(field_id) {
		selected_tabs[field_id] = 'field'
	}
	function select_tab(field_id, tab) {
		selected_tabs[field_id] = tab
	}
	function set_all_tabs(tab) {
		Object.keys(selected_tabs).forEach((field_id) => {
			selected_tabs[field_id] = tab
		})
	}
	get(`active-tabs--${id}`).then((saved) => {
		if (saved) {
			Object.keys(saved).forEach((field_id) => {
				const saved_tab = saved[field_id]
				selected_tabs[field_id] = ['field', 'entry'].includes(saved_tab) ? saved_tab : 'entry'
			})
		}
	})
	$effect(() => {
		// set(`active-tabs--${id}`, selected_tabs)
	})
	$inspect({ fields, entries, $site, $active_page, $page_type })

	$effect(() => validate_conditions(fields))
	function validate_conditions(fields) {
		fields
			.filter((f) => f.options?.condition)
			.forEach((field) => {
				const comparable_fields = fields.filter((f) => f.parent === field.parent && f.id !== field.id && f.index < field.index && !f.options.condition)
				const { field: field_to_check_id, value, comparison } = field.options.condition
				const field_to_check = comparable_fields.find((f) => f.id === field_to_check_id)
				if (!field_to_check) {
					// comparable field deleted, reset condition
					update_field({ id: field.id, data: { options: { ...field.options, condition: null } } })
				}
			})
	}
</script>

<div class="Fields">
	{#each parent_fields.sort((a, b) => a.index - b.index) as field (field.id)}
		{@const Field_Component = get_component(field)}
		<!-- {@const is_visible = check_condition(field) && belongs_to_current_page_type(field)} -->
		{@const active_tab = $userRole === 'DEV' ? selected_tabs[field.id] : 'entry'}
		{@const is_visible = check_condition(field)}
		<div class="entries-item">
			<!-- TODO: hotkeys for tab switching  -->
			{#if $userRole === 'DEV'}
				<div class="top-tabs">
					<button
						data-test-id="field"
						class:active={active_tab === 'field'}
						disabled={active_tab === 'field'}
						onclick={() => {
							if ($mod_key_held) {
								set_all_tabs('field')
							} else {
								select_tab(field.id, 'field')
							}
						}}
					>
						<Icon icon="fluent:form-48-filled" />
						<span>Field</span>
					</button>
					<button
						data-test-id="entry"
						style="border-top: 1px solid var(--color-gray-9);"
						class:active={active_tab === 'entry'}
						disabled={active_tab === 'entry'}
						onclick={() => {
							if ($mod_key_held) {
								set_all_tabs('entry')
							} else {
								select_tab(field.id, 'entry')
							}
						}}
					>
						<Icon icon={is_visible ? $fieldTypes.find((ft) => ft.id === field.type).icon : 'mdi:hide'} />
						{#if field.type === 'repeater'}
							<span>Entries</span>
						{:else}
							<span>Entry</span>
						{/if}
					</button>
				</div>
			{/if}
			<div class="container">
				{#if active_tab === 'field'}
					<div class="FieldItem">
						<FieldItem
							{field}
							{fields}
							on:duplicate={({ detail: field }) => duplicate_field(field)}
							on:delete={({ detail: field }) => delete_field(field)}
							on:createsubfield={({ detail: field }) => create_subfield(field)}
							on:move={({ detail }) => move_field(detail)}
							on:input={({ detail }) => update_field(detail)}
							on:keydown
						/>
					</div>
				{:else if active_tab === 'entry'}
					{#if is_visible}
						{@const content_entry = get_content_entry(field)}
						{@const is_dynamic_field_type = ['site-field', 'page-field'].includes(field.type)}
						{@const source_entry = entries.find((e) => e.field === field.source)}
						{@const source_field = [...$site.fields, ...$active_page.page_type.fields, ...$page_type.fields].find((f) => f.id === field.source)}
						{#if is_dynamic_field_type && source_entry && source_field}
							{@const dynamic_field_type = { 'page-field': 'page', 'site-field': 'site' }[field.type]}
							{@const title = ['repeater', 'group'].includes(source_field.type) ? field.label : null}
							{@const icon = title ? $fieldTypes.find((ft) => ft.id === source_field.type)?.icon : null}
							<div class="dynamic-header">
								{#if dynamic_field_type === 'site'}
									<Icon icon="gg:website" />
									<span>Site Property</span>
								{:else if dynamic_field_type === 'page'}
									<Icon icon={$active_page.page_type?.icon || $page_type.icon} />
									<span>Page Property</span>
								{/if}
							</div>
							<Card {title} {icon}>
								<Field_Component
									id={source_entry.id}
									value={source_entry.value}
									{entries}
									{field}
									{fields}
									on:keydown
									on:add={({ detail }) => add_repeater_item({ ...detail, dynamic: dynamic_field_type })}
									on:remove={({ detail }) => remove_repeater_item(detail, dynamic_field_type)}
									on:move={({ detail }) => move_repeater_item(detail)}
									oninput={(value) => {
										dispatch_update({
											entries: value.entries,
											content_changes: [{ action: 'update', id: value.id, data: value.data, dynamic: dynamic_field_type }]
										})
									}}
								/>
							</Card>
						{:else if content_entry}
							{@const title = ['repeater', 'group'].includes(field.type) ? field.label : null}
							{@const icon = title ? $fieldTypes.find((ft) => ft.id === field.type)?.icon : null}
							<Card {title} {icon}>
								<Field_Component
									id={content_entry.id}
									{field}
									value={content_entry.value}
									metadata={content_entry.metadata}
									{entries}
									{fields}
									autocomplete={content_entry.value === ''}
									{onkeydown}
									on:add={({ detail }) => add_repeater_item(detail)}
									on:remove={({ detail }) => remove_repeater_item(detail)}
									on:move={({ detail }) => move_repeater_item(detail)}
									oninput={(value) => {
										// attach entry id for nested 'input' dispatches
										const row_id = value.id || content_entry.id
										const data = value.data || value

										const updated_entries = entries.map((row) => (row.id === row_id ? { ...row, ...data } : row))
										dispatch_update({
											entries: updated_entries,
											content_changes: [{ action: 'update', id: row_id, data }]
										})
									}}
								/>
							</Card>
						{:else}
							<span>Field {field.id} is corrupted, should be deleted.</span>
						{/if}
					{:else if !is_visible && $userRole === 'DEV'}
						<div class="hidden-field">
							<Icon icon="mdi:hidden" />
							<span>This field will be hidden from content editors</span>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/each}
	{#if $userRole === 'DEV'}
		<button class="field-button" onclick={create_field}>
			<div class="icon">
				<Icon icon="fa-solid:plus" />
			</div>
			<span>Create Field</span>
		</button>
	{/if}
</div>

<style lang="postcss">
	.Fields {
		width: 100%;
		display: grid;
		gap: 1rem;
		/* padding-top: 0.5rem; */
		padding-bottom: 1rem;
		padding-right: 10px;
		color: var(--color-gray-2);
		height: 100%;
		overflow-y: auto;
		place-content: flex-start;
		justify-content: stretch;
	}
	.dynamic-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		border-bottom: 1px solid var(--color-gray-9);
		padding-block: 0.5rem;
		font-size: 0.75rem;
	}
	.hidden-field {
		padding: 1rem;
		color: var(--color-gray-2);
		font-size: 0.875rem;
	}
	.entries-item {
		display: grid;
		background: #1a1a1a;
		border-radius: 0.5rem;
		/* grid-template-columns: 1fr auto; */

		.container {
			border-bottom-left-radius: var(--primo-border-radius);
			border-bottom-right-radius: var(--primo-border-radius);
			overflow: hidden;
		}
		.top-tabs {
			display: grid;
			grid-template-columns: 1fr 1fr;
			button {
				background: #111;
				transition: 0.1s;
				opacity: 0.5;
				padding: 0.5rem;
				border-bottom: 1px solid var(--color-gray-9);
				display: flex;
				justify-content: center;
				align-items: center;
				gap: 0.5rem;
				font-size: 0.75rem;
			}

			button[disabled] {
				cursor: initial;
			}

			button:hover {
				opacity: 0.6;
			}

			button:first-child {
				border-top-left-radius: var(--primo-border-radius);
			}

			button:last-child {
				border-top-right-radius: var(--primo-border-radius);
			}

			button.active {
				background: transparent;
				color: var(--color-gray-2);
				opacity: 1;
			}
		}
	}
	.field-button {
		width: 100%;
		/* background: #292929; */
		background: #1f1f1f;
		color: var(--button-color);
		transition:
			background 0.1s,
			color 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		/* font-size: 0.875rem; */
		font-size: var(--font-size-2);
		padding: 0.5rem;
		border-radius: 4px;
		font-weight: 400;
		border: 1px solid transparent;
		transition: 0.1s;

		&:hover {
			/* background: #333333; */
			background: #292929;
		}

		&:focus {
			border-color: var(--primo-color-brand);
		}
		&:focus-visible {
			outline: 0;
		}
	}
</style>
