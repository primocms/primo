<script>
	import { createEventDispatcher } from 'svelte'
	import _, { find, cloneDeep, chain as _chain, set as _set, get as _get, isRegExp as _isRegExp } from 'lodash-es'
	import Icon from '@iconify/svelte'
	import Card from '../ui/Card.svelte'
	import { userRole, fieldTypes, locale } from '../stores/app'
	import active_page from '../stores/data/page.js'
	import { is_regex, get_empty_value } from '../utils'
	import { Content_Row } from '../factories'
	import { dataChanged } from '../database.js'

	/**
	 * @typedef {Object} Props
	 * @property {any} entries
	 * @property {any} fields
	 * @property {boolean} [minimal]
	 */

	/** @type {Props} */
	let { entries, fields, minimal = false } = $props()

	const dispatch = createEventDispatcher()

	function get_ancestors(entry) {
		const parent = entries.find((e) => e.id === entry.parent)
		return parent ? [parent.id, ...get_ancestors(parent)] : []
	}

	function get_component(field) {
		const fieldType = find($fieldTypes, ['id', field.type])
		if (fieldType) {
			return fieldType.component
		} else {
			console.warn(`Field type '${field.type}' no longer exists, removing '${field.label}' field`)
			return null
		}
	}

	function check_condition(field) {
		if (!field.options.condition) return true // has no condition

		const { field: field_id, value, comparison } = field.options.condition
		const field_to_compare = fields.find((f) => f.id === field_id)
		if (!field_to_compare) {
			// field has been deleted, reset condition
			field.options.condition = null
			return false
		}

		// TODO: ensure correct field (considering repeaters)
		const { value: comparable_value } = entries.find((e) => e.field === field_id)
		if (is_regex(value)) {
			const regex = new RegExp(value.slice(1, -1))
			if (comparison === '=' && regex.test(comparable_value)) {
				return true
			} else if (comparison === '!=' && !regex.test(comparable_value)) {
				return true
			}
		} else if (comparison === '=' && value === comparable_value) {
			return true
		} else if (comparison === '!=' && value !== comparable_value) {
			return true
		}
		return false
	}

	function add_repeater_item({ parent, index, subfields }) {
		const parent_container = entries.find((r) => r.id === parent)
		const new_repeater_item = Content_Row({ parent: parent_container.id, index })
		const new_entries = subfields.map((subfield) =>
			Content_Row({
				parent: new_repeater_item.id,
				field: subfield.id,
				value: get_empty_value(subfield),
				locale: subfield.type === 'repeater' || subfield.type === 'group' ? null : $locale
			})
		)
		const new_rows = [new_repeater_item, ...new_entries]
		const updated_content = cloneDeep([...entries, ...new_rows])
		dispatch_update({
			entries: updated_content
		})
	}

	function remove_repeater_item(item) {
		let updated_content = cloneDeep(entries.filter((c) => c.id !== item.id)) // remove repeater item entry

		// get siblings, update indeces
		const siblings = updated_content
			.filter((c) => c.parent === item.parent)
			.sort((a, b) => a.index - b.index)
			.map((c, i) => ({ ...c, index: i }))
		for (const sibling of siblings) {
			const entry = updated_content.find((c) => c.id === sibling.id)
			entry.index = sibling.index
		}

		// remove descendents
		updated_content = updated_content.filter((entry) => {
			const is_descendent = get_ancestors(entry).includes(item.id)
			if (is_descendent) {
				return false
			} else return true
		})

		dispatch_update({
			entries: updated_content
		})
	}

	function move_repeater_item({ item, direction }) {
		const updated_content = cloneDeep(entries)

		// select siblings (could be root level)
		const siblings = updated_content.filter((c) => c.parent === item.parent && c.id !== item.id).sort((a, b) => a.index - b.index)

		// update siblings & self w/ new indeces
		const updated_children = {
			up: [...siblings.slice(0, item.index - 1), item, ...siblings.slice(item.index - 1)],
			down: [...siblings.slice(0, item.index + 1), item, ...siblings.slice(item.index + 1)]
		}[direction].map((f, i) => ({ ...f, index: i }))

		// set updated_content w/ updated indeces
		for (const child of updated_children) {
			const row = updated_content.find((c) => c.id === child.id)
			row.index = child.index
		}
		dispatch_update({
			entries: updated_content
		})
	}

	function dispatch_update(updated) {
		dispatch('input', {
			original: entries,
			updated: _.cloneDeep(updated.entries)
		})
	}

	async function get_source_content(field) {
		const [source_entry] = await dataChanged({
			table: 'entries',
			action: 'select',
			match: { field: field.source, page: $active_page.id }
		})
		const target_entry = entries.find((e) => e.field === field.id)
		return source_entry ? { ...target_entry, value: source_entry.value } : target_entry
	}

	function belongs_to_current_page_type(field) {
		if (!field.source) return true
		else return $active_page.page_type.fields.some((f) => f.id === field.source)
	}

	// $inspect({ entries, fields })
</script>

<div class="Content">
	{#each fields.filter((f) => !f.parent).sort((a, b) => a.index - b.index) as field}
		{@const content_entry = entries.find((r) => r.field === field.id)}
		<!-- weird race condition bug, fields is dirty when switching pages w/ sidebar open -->
		{@const Field_Component = get_component(field)}
		{@const is_visible = check_condition(field) && belongs_to_current_page_type(field)}
		{@const is_valid = (field.key || field.type === 'info') && Field_Component}
		{@const has_child_fields = field.type === 'repeater' || field.type === 'group'}
		{#if field.source && is_valid && is_visible}
			{#await get_source_content(field)}
				<Card title={has_child_fields ? field.label : null} icon={$fieldTypes.find((ft) => ft.id === field.type)?.icon}>
					<div class="field-item" id="field-{field.key}">
						<Icon icon="line-md:loading-twotone-loop" />
					</div>
				</Card>
			{:then fetched_entry}
				<Card title={has_child_fields ? field.label : null} icon={$fieldTypes.find((ft) => ft.id === field.type)?.icon}>
					<div class="field-item" id="field-{field.key}" class:repeater={field.key === 'repeater'}>
						<Field_Component
							id={fetched_entry.id}
							value={fetched_entry.value}
							{entries}
							field={{ ...field, label: `${field.label} (PAGE FIELD)` }}
							{fields}
							disabled={true}
							on:keydown
							oninput={(detail) => {
								// TODO: handle edit for linked field entries

								// attach entry id for nested 'input' dispatches
								const row_id = detail.id || fetched_entry.id
								const data = detail.data || detail

								const updated_content = entries.map((row) => (row.id === row_id ? { ...row, ...data } : row))

								dispatch_update({
									entries: updated_content
								})
							}}
						/>
					</div>
				</Card>
			{/await}
		{:else if is_valid && is_visible}
			<Card title={has_child_fields ? field.label : null} icon={$fieldTypes.find((ft) => ft.id === field.type)?.icon} pill={field.is_static ? 'Static' : null} {minimal}>
				<div class="field-item" id="field-{field.key}" class:repeater={field.key === 'repeater'}>
					<Field_Component
						id={content_entry.id}
						value={content_entry.value}
						{entries}
						{field}
						{fields}
						autocomplete={content_entry.value === ''}
						on:keydown
						on:add={({ detail }) => add_repeater_item(detail)}
						on:remove={({ detail }) => remove_repeater_item(detail)}
						on:move={({ detail }) => move_repeater_item(detail)}
						oninput={(detail) => {
							// attach entry id for nested 'input' dispatches
							const row_id = detail.id || content_entry.id
							const data = detail.data || detail

							const updated_content = entries.map((row) => (row.id === row_id ? { ...row, ...data } : row))

							dispatch_update({
								entries: updated_content
							})
						}}
					/>
				</div>
			</Card>
		{:else if is_visible}
			<p class="empty-description">Field requires a key</p>
		{/if}
	{:else}
		<p class="empty-description">
			{#if $userRole === 'DEV'}
				When you create fields, they'll be editable from here
			{:else}
				When the site developer creates fields, they'll be editable from here
			{/if}
		</p>
	{/each}
</div>

<style lang="postcss">
	.Content {
		width: 100%;
		display: grid;
		gap: 1rem;
		padding-bottom: 0.5rem;
		/* padding-block: 0.5rem; */
		color: var(--color-gray-2);
		/* background: var(--primo-color-black); */
		height: 100%;
		overflow-y: auto;
		place-content: flex-start;
		justify-content: stretch;

		.empty-description {
			color: var(--color-gray-4);
			font-size: var(--font-size-2);
			height: 100%;
			display: flex;
			align-items: flex-start;
			justify-content: center;
			margin-top: 12px;
		}
	}
</style>
