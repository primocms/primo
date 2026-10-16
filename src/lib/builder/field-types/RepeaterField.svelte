<script lang="ts">
	import Icon from '@iconify/svelte'
	import { onDestroy } from 'svelte'
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
		ondelete,
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

	let repeater_entries = $derived(entries?.filter((r) => r.field === field.id && (parent ? r.parent === parent.id : !r.parent)).sort((a, b) => a.index - b.index))
	let subfields = $derived(fields?.filter((f) => f.parent === field.id).sort((a, b) => a.index - b.index))

	let repeater_item_just_created = $state<number | null>(null) // to autofocus on creation
	function add_item() {
		repeater_item_just_created = 0
		for (const entry of repeater_entries) {
			if (entry.index >= repeater_item_just_created) {
				repeater_item_just_created = entry.index + 1
			}
		}

		onchange({
			[field.key]: {
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

		const created = repeater_entries.find((entry) => entry.index === repeater_item_just_created)
		if (created) visibleRepeaters[created.id] = true
	}

	function move_item(entry: Entry, direction: -1 | 1) {
		if ($read_only || !field.key) return
		const position = repeater_entries.findIndex((item) => item.id === entry.id)
		const destination = position + direction
		if (position < 0 || destination < 0 || destination >= repeater_entries.length) return
		const reordered = [...repeater_entries]
		reordered.splice(destination, 0, reordered.splice(position, 1)[0])
		repeater_item_just_created = null
		onchange({ [field.key]: Object.fromEntries(reordered.map((item, index) => [index, { entryId: item.id }])) })
	}

	let visibleRepeaters = $state<Record<string, boolean>>({})

	idb.get(field.id).then((res) => {
		if (res) {
			visibleRepeaters = res
		}
	})

	onDestroy(() => {
		// save visible repeaters
		idb.set(field.id, { ...visibleRepeaters })
	})

	// TODO: Handle these
	let show_label = false
</script>

<div class="RepeaterField repeater-level-{level}">
	{#if show_label}
		<p class="primo--field-label">{field.label}</p>
	{/if}
	<ul class="fields">
		{#each repeater_entries as entry, position (entry.id)}
			{@const index = entry.index}
			{@const subfield_id = entry.id}
			{@const autofocus = index === repeater_item_just_created}
			<li>
				<RepeaterFieldItem
					{entity}
					{field}
					{entry}
					{index}
					{fields}
					{subfields}
					{entries}
					{level}
					{autofocus}
					can_move_up={position > 0}
					can_move_down={position < repeater_entries.length - 1}
					onmove={(direction) => move_item(entry, direction)}
					{onchange}
					{ondelete}
					is_visible={visibleRepeaters[subfield_id]}
					on:toggle={() => (visibleRepeaters[subfield_id] = !visibleRepeaters[subfield_id])}
					on:toggleall={() => {
						const all_visible = repeater_entries.every((e) => visibleRepeaters[e.id])
						repeater_entries.forEach((e) => {
							visibleRepeaters[e.id] = !all_visible
						})
					}}
					on:remove={() => {
						// Delete the repeater item entry
						// PocketBase cascade deletion will automatically clean up all sub-entries
						if (ondelete) {
							ondelete(entry.id)
						}

						// Remove from visible repeaters tracking
						delete visibleRepeaters[entry.id]
					}}
				/>
			</li>
		{/each}
	</ul>
	{#if !$read_only}
		<button class="field-button" onclick={add_item}>
			<Icon icon="akar-icons:plus" />
			<span>Create {pluralize.singular(field.label)}</span>
		</button>
	{/if}
</div>

<style lang="postcss">
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
