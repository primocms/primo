<script lang="ts" module>
	/**
	 * Map of field key to object keyed by index specifying value and optionally sub-values.
	 */
	export type FieldValueMap = Record<string, Record<number, { value: unknown; subValues?: FieldValueMap }>>

	/**
	 * Handler used when reporting change of field value.
	 */
	export type FieldValueHandler = (values: FieldValueMap) => void

	export function setFieldEntries(options: {
		fields?: Field[]
		entries?: Entry[]
		updateEntry: (id: string, data: Partial<Entry>) => Entry
		createEntry: (data: Omit<Entry, 'id'>) => Entry
		values: FieldValueMap
		parent?: Entry
	}) {
		const { fields, entries, updateEntry, createEntry, values, parent } = options
		for (const [key, items] of Object.entries(values)) {
			for (const index in items) {
				const field = fields?.find((field) => field.key === key && (parent ? field.parent === parent?.field : !field.parent))
				if (!field) {
					continue
				}

				let entry = entries?.find((entry) => entry.field === field?.id && (parent ? entry.parent === parent?.id : !entry.parent) && entry.index === +index)
				if (entry) {
					entry = updateEntry(entry.id, { value: items[index].value })
				} else {
					entry = createEntry({ field: field.id, parent: parent?.id, index: +index, locale: 'en', value: items[index].value })
				}

				if (items[index].subValues) {
					setFieldEntries({ ...options, values: items[index].subValues, parent: entry })
				}
			}
		}
	}
</script>

<script lang="ts">
	import Icon from '@iconify/svelte'
	import * as _ from 'lodash-es'
	import { watch } from 'runed'
	import FieldItem from './FieldItem.svelte'
	import { fieldTypes } from '../../stores/app/index.js'
	import { mod_key_held, field_tabs_by_entity } from '../../stores/app/misc.js'
	import type { Field } from '$lib/common/models/Field'
	import type { Entity } from '$lib/Entity'
	import type { Entry } from '$lib/common/models/Entry'
	import EntryContent from './EntryContent.svelte'
	import { current_user } from '$lib/pocketbase/user'

	let {
		entity,
		fields,
		entries,
		create_field,
		oninput,
		onchange,
		ondelete,
		ondelete_entry
	}: {
		entity: Entity
		fields: Field[]
		entries: Entry[]
		create_field: (data?: Partial<Field>) => void
		oninput: FieldValueHandler
		onchange: (details: { id: string; data: Partial<Field> }) => void
		ondelete: (field: Field) => void
		ondelete_entry: (entry_id: string) => void
	} = $props()

	// TABS - Simple persistent approach
	let selected_tabs = $state<Record<string, 'field' | 'entry'>>($field_tabs_by_entity?.[entity?.id] || {})

	// Track field IDs to detect newly created fields
	const current_field_ids = () => (fields || []).filter((f) => !f.parent || f.parent === '').map((f) => f.id)
	let previous_field_ids = $state<string[]>(current_field_ids())

	// Initialize tabs for new fields when they appear, using an explicit watch
	watch(current_field_ids, (parent_field_ids) => {
		let changed = false
		for (const id of parent_field_ids) {
			if (!(id in selected_tabs)) {
				// If this is a newly created field (not in previous list), show field tab
				// Otherwise, show entry tab by default for existing fields
				const is_new_field = !previous_field_ids.includes(id)
				selected_tabs[id] = is_new_field && $current_user?.siteRole === 'developer' ? 'field' : 'entry'
				changed = true
			}
		}
		previous_field_ids = [...parent_field_ids]
		if (changed) persist_tabs()
	})

	function select_tab(field_id, tab) {
		selected_tabs[field_id] = tab
		persist_tabs()
	}
	function set_all_tabs(tab) {
		Object.keys(selected_tabs).forEach((field_id) => {
			selected_tabs[field_id] = tab
		})
		persist_tabs()
	}
	function persist_tabs() {
		const entity_id = (entity as any)?.id
		if (!entity_id) return
		const current = $field_tabs_by_entity?.[entity_id] || {}
		if (!_.isEqual(current, selected_tabs)) {
			$field_tabs_by_entity = { ...$field_tabs_by_entity, [entity_id]: { ...selected_tabs } }
		}
	}
	// Field reordering function
	function move_field(field: Field, direction: 'up' | 'down') {
		// Get all top-level fields (same parent level as the field being moved)
		const siblings = fields.filter((f) => (f.parent || '') === (field.parent || ''))

		// Sort by index to get current order
		const sorted_siblings = siblings.sort((a, b) => (a.index || 0) - (b.index || 0))

		// Find current position
		const current_index = sorted_siblings.findIndex((f) => f.id === field.id)

		if (current_index === -1) return // Field not found

		// Calculate new position
		let new_index = current_index
		if (direction === 'up' && current_index > 0) {
			new_index = current_index - 1
		} else if (direction === 'down' && current_index < sorted_siblings.length - 1) {
			new_index = current_index + 1
		} else {
			return // Can't move further in that direction
		}

		// Swap the fields - use the other field's current index value
		const field_to_swap = sorted_siblings[new_index]
		const temp_index = field.index || current_index

		// Update the indices by swapping them
		onchange({ id: field.id, data: { index: field_to_swap.index || new_index } })
		onchange({ id: field_to_swap.id, data: { index: temp_index } })
	}

	function duplicate_field(field: Field) {
		create_field(field)
	}

	function delete_field_related_records(field_id: string) {
		// Delete sub-fields
		for (const field of fields) {
			if (field.parent === field_id) {
				delete_field_related_records(field.id)
				ondelete(field)
			}
		}

		// Delete all entries attached to the field.
		for (const entry of entries) {
			if (entry.field === field_id) {
				delete_entry_related_records(entry.id)
				ondelete_entry(entry.id)
			}
		}
	}

	function delete_entry_related_records(entry_id: string) {
		// Delete all sub-entries.
		for (const entry of entries) {
			if (entry.parent === entry_id) {
				delete_entry_related_records(entry.id)
				ondelete_entry(entry.id)
			}
		}
	}

	function handle_change(details: { id: string; data: Partial<Field> }) {
		if ('type' in details.data) {
			// Changing field type.
			delete_field_related_records(details.id)
		}

		onchange(details)
	}

	function handle_delete_field(field: Field) {
		delete_field_related_records(field.id)
		ondelete(field)
	}

	function handle_delete_entry(entry_id: string) {
		delete_entry_related_records(entry_id)
		ondelete_entry(entry_id)
	}
</script>

<div class="Fields">
	{#each (fields || []).filter((f) => !f.parent || f.parent === '').sort((a, b) => a.index - b.index) as field (field.id)}
		{@const active_tab = selected_tabs[field.id] ?? 'entry'}
		<div class="entries-item">
			{#if $current_user?.siteRole === 'developer'}
				<div class="top-tabs">
					<button
						data-test-id="field"
						class:active={active_tab === 'field'}
						class:showing_key_hint={$mod_key_held && active_tab !== 'field'}
						ondblclick={() => set_all_tabs('field')}
						onclick={() => {
							if ($mod_key_held) {
								set_all_tabs('field')
							} else {
								if (active_tab !== 'field') select_tab(field.id, 'field')
							}
						}}
						title={$mod_key_held ? 'Set all fields to Field tab' : ''}
					>
						{#if $mod_key_held && active_tab !== 'field'}
							<span class="key-hint">
								<span>&#8984;</span>
								<Icon icon="fa6-solid:hand-pointer" />
							</span>
						{/if}
						<span class="tab-content">
							<Icon icon="fluent:form-48-filled" />
							<span>Field</span>
						</span>
					</button>
					<button
						data-test-id="entry"
						class="border-t border-(--color-gray-9)"
						class:active={active_tab === 'entry'}
						class:showing_key_hint={$mod_key_held && active_tab !== 'entry'}
						ondblclick={() => set_all_tabs('entry')}
						onclick={() => {
							if ($mod_key_held) {
								set_all_tabs('entry')
							} else {
								if (active_tab !== 'entry') select_tab(field.id, 'entry')
							}
						}}
						title={$mod_key_held ? 'Set all fields to Entry tab' : ''}
					>
						{#if $mod_key_held && active_tab !== 'entry'}
							<span class="key-hint">
								<span>&#8984;</span>
								<Icon icon="fa6-solid:hand-pointer" />
							</span>
						{/if}
						<span class="tab-content">
							<Icon icon={$fieldTypes.find((f) => f.id === field.type)?.icon} />
							{#if field.type === 'repeater'}
								<span>Entries</span>
							{:else}
								<span>Entry</span>
							{/if}
						</span>
					</button>
				</div>
			{/if}
			<div class="container">
				{#if active_tab === 'field'}
					<div class="FieldItem">
						<FieldItem
							{field}
							{fields}
							{create_field}
							onchange={handle_change}
							ondelete={handle_delete_field}
							onduplicate={() => {
								duplicate_field(field)
							}}
							onmove={(id, direction) => {
								const field_to_move = fields.find((f) => f.id === id)
								if (field_to_move) {
									move_field(field_to_move, direction)
								}
							}}
						/>
					</div>
				{:else if active_tab === 'entry'}
					<EntryContent {entity} {field} {fields} {entries} level={0} onchange={oninput} ondelete={handle_delete_entry} />
				{/if}
			</div>
		</div>
	{/each}
	{#if $current_user?.siteRole === 'developer'}
		<button class="field-button" onclick={() => create_field()}>
			<Icon icon="fa-solid:plus" />
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
		/* padding-right: 10px; */
		color: var(--color-gray-2);
		height: 100%;
		overflow-y: auto;
		place-content: flex-start;
		justify-content: stretch;
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
				position: relative;
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

			button.showing_key_hint .tab-content {
				visibility: hidden;
			}

			button .tab-content {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
			}

			button .key-hint {
				position: absolute;
				inset: 0;
				font-size: 0.75rem;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.25rem;
				pointer-events: none;
			}
		}
	}
	.field-button {
		width: 100%;
		/* background: #292929; */
		background: var(--primo-color-codeblack);
		color: var(--button-color);
		transition:
			background 0.1s,
			color 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		/* font-size: 0.875rem; */
		font-size: var(--font-size-1);
		padding: 0.375rem;
		border-radius: 4px;
		font-weight: 400;
		border: 1px solid transparent;
		transition: 0.1s;

		&:hover {
			/* background: #333333; */
			background: #292929;
		}

		&:focus {
			border-color: var(--primo-primary-color);
		}
		&:focus-visible {
			outline: 0;
		}
	}
</style>
