<script lang="ts">
	import Icon from '@iconify/svelte'
	import { tick, untrack } from 'svelte'
	import { locale } from '../stores/app/misc'
	import { reorderRepeater, repeaterScope, orderKey } from './repeater-order'
	import { repeaterAutoScroll } from './repeater-drag'
	import RepeaterFieldItem from './RepeaterFieldItem.svelte'
	import * as idb from 'idb-keyval'
	import pluralize from 'pluralize'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Entity } from '$lib/Entity'
	import type { Field } from '$lib/common/models/Field'
	import { get_empty_value } from '../utils'
	import { read_only } from '$lib/pocketbase/author_mode'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'

	let {
		entity,
		field,
		fields,
		entries,
		onchange,
		ondelete = () => {},
		level,
		parent
	}: {
		entity: Entity
		field: Field
		entry?: Entry
		fields: Field[]
		entries: Entry[]
		onchange: FieldValueHandler
		ondelete?: (entry_id: string) => void
		level: number
		parent?: Entry
	} = $props()

	let repeater_entries = $derived(entries?.filter((r) => r.field === field.id && r.locale === $locale && (parent ? r.parent === parent.id : !r.parent)).sort((a, b) => a.index - b.index))
	let subfields = $derived(fields?.filter((f) => f.parent === field.id).sort((a, b) => a.index - b.index))

	let repeater_item_just_created = $state<number | null>(null)
	let created_id = $state<string | null>(null) // to autofocus on creation
	function add_item() {
		repeater_item_just_created = 0
		for (const entry of repeater_entries) {
			if (entry.index >= repeater_item_just_created) {
				repeater_item_just_created = entry.index + 1
			}
		}

		onchange({
			[field.key ?? '']: {
				[repeater_item_just_created]: {
					value: null,
					subValues: Object.fromEntries(
						subfields.map((subfield) => [
							subfield.key,
							{
								0: { value: get_empty_value(subfield) }
							}
						])
					)
				}
			}
		})
	}

	let visibleRepeaters = $state<Record<string, boolean>>({})
	const scope = $derived(repeaterScope(entity, field, parent, $locale))
	const scope_key = $derived(orderKey(scope))
	const storage_key = $derived(`repeater-visible-v2:${scope_key}`)
	const save_error = $derived(entity.collection.manager.entry_reordering.errors.get(scope_key))
	let retrying = $state(false)
	let announcement = $state('')

	$effect(() => {
		const key = storage_key
		visibleRepeaters = {}
		let disposed = false
		const state = untrack(() => visibleRepeaters)
		idb
			.get<Record<string, boolean>>(key)
			.then((saved) => {
				if (!disposed && saved) {
					// Toggles made before hydration win over the stored state.
					visibleRepeaters = { ...saved, ...state }
				}
			})
			.catch(() => {})
		return () => {
			disposed = true
		}
	})

	$effect(() => {
		if (repeater_item_just_created === null) return
		const item = repeater_entries.find((entry) => entry.index === repeater_item_just_created)
		if (!item) return
		created_id = item.id
		visibleRepeaters[item.id] = true
		repeater_item_just_created = null
	})

	function persist_visibility() {
		idb.set(storage_key, { ...visibleRepeaters }).catch(() => {})
	}

	async function move_item(moved_id: string, target_id: string, edge: 'top' | 'bottom') {
		if ($read_only) return
		if (!reorderRepeater(entity, field, parent, repeater_entries, moved_id, target_id, edge)) return
		// Empty input signals the owning editor's usual Save/autosave path.
		onchange({})
		await tick()
		const position = repeater_entries.findIndex((entry) => entry.id === moved_id)
		announcement = `${pluralize.singular(field.label || 'Items')} moved to position ${position + 1} of ${repeater_entries.length}.`
	}

	let show_label = false
</script>

<div class="RepeaterField repeater-level-{level}" use:repeaterAutoScroll={scope_key}>
	<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
	{#if save_error}
		<div class="order-error">
			<p role="alert">{save_error}</p>
			{#if !save_error.includes('changed elsewhere') && !$read_only}
				<button
					disabled={retrying}
					onclick={async () => {
						retrying = true
						try {
							await entity.collection.manager.commit()
						} catch {
						} finally {
							retrying = false
						}
					}}
				>
					Retry saving order
				</button>
			{/if}
		</div>
	{/if}
	{#if show_label}
		<p class="primo--field-label">{field.label}</p>
	{/if}
	<ul class="fields">
		{#each repeater_entries as entry, position (entry.id)}
			{@const index = entry.index}
			{@const autofocus = entry.id === created_id}
			<li>
				<RepeaterFieldItem
					{entity}
					{field}
					{entry}
					{index}
					{position}
					count={repeater_entries.length}
					{scope_key}
					onmove={move_item}
					onmove_position={(destination) => {
						const target = repeater_entries[destination]
						if (target) move_item(entry.id, target.id, destination < position ? 'top' : 'bottom')
					}}
					{fields}
					{subfields}
					{entries}
					{level}
					{autofocus}
					{onchange}
					{ondelete}
					is_visible={!!visibleRepeaters[entry.id]}
					on:toggle={() => {
						visibleRepeaters[entry.id] = !visibleRepeaters[entry.id]
						persist_visibility()
					}}
					on:toggleall={() => {
						const all_visible = repeater_entries.every((e) => visibleRepeaters[e.id])
						repeater_entries.forEach((e) => {
							visibleRepeaters[e.id] = !all_visible
						})
						persist_visibility()
					}}
					on:remove={() => {
						// Delete the repeater item entry
						// PocketBase cascade deletion will automatically clean up all sub-entries
						if (ondelete) {
							ondelete(entry.id)
						}

						// Remove from visible repeaters tracking
						delete visibleRepeaters[entry.id]
						persist_visibility()
					}}
					on:keydown
					on:add
				/>
			</li>
		{/each}
	</ul>
	{#if !$read_only}
		<button class="field-button" onclick={add_item}>
			<Icon icon="akar-icons:plus" />
			<span>Create {pluralize.singular(field.label || 'Items')}</span>
		</button>
	{/if}
</div>

<style lang="postcss">
	.order-error {
		color: #f6b1a2;
		font-size: 0.8rem;
		padding: 0.5rem;
	}
	.RepeaterField {
		width: 100%;
	}
	.fields {
		display: grid;
		/* gap: 1.5rem; */
		padding-bottom: 0.5rem;
	}
	button.field-button {
		width: 100%;
		background: var(--primo-color-codeblack);
		color: var(--button-color);
		transition:
			background 0.1s,
			color 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: var(--font-size-1);
		padding: 0.375rem;
		border-radius: var(--primo-border-radius);
		font-weight: 400;
		border: 1px solid transparent;
		transition: 0.1s;

		&:hover {
			/* background: var(--button-hover-color); */
			background: #292929;
		}

		/* &[disabled] {
      background: var(--color-gray-5);
      cursor: not-allowed;
    } */
	}
	.repeater-level-0 {
		--field-border-color: #252627;
	}

	.repeater-level-1 {
		--field-border-color: #3e4041;
	}

	.repeater-level-2 {
		--field-border-color: #58595b;
	}

	.repeater-level-3 {
		--field-border-color: #888;
	}

	.repeater-level-4 {
		--field-border-color: #aaa;
	}

	.repeater-level-5 {
		--field-border-color: #ccc;
	}

	.repeater-level-5 {
		--field-border-color: #eee;
	}
</style>
