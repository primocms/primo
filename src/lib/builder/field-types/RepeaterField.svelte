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

		visibleRepeaters[`${field.key}-${repeater_item_just_created}`] = true
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

	let hover_index = $state(null)
	let hover_position = $state(null)
</script>

<div class="RepeaterField repeater-level-{level}">
	{#if show_label}
		<p class="primo--field-label">{field.label}</p>
	{/if}
	<ul class="fields">
		{#each repeater_entries as entry (entry.id)}
			{@const index = entry.index}
			{@const subfield_id = `${field.key}-${index}`}
			{@const autofocus = index === repeater_item_just_created}
			{@const hovering = hover_index === index}
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
					{onchange}
					{ondelete}
					is_visible={visibleRepeaters[subfield_id]}
					on:toggle={() => (visibleRepeaters[subfield_id] = !visibleRepeaters[subfield_id])}
					on:toggleall={() => {
						const all_visible = repeater_entries.every((e) => visibleRepeaters[`${field.key}-${e.index}`])
						repeater_entries.forEach((e) => {
							visibleRepeaters[`${field.key}-${e.index}`] = !all_visible
						})
					}}
					on:hover={({ detail }) => {
						hover_index = index
						hover_position = detail
					}}
					{hovering}
					{hover_position}
					on:move
					on:remove={() => {
						// Delete the repeater item entry
						// PocketBase cascade deletion will automatically clean up all sub-entries
						if (ondelete) {
							ondelete(entry.id)
						}

						// Remove from visible repeaters tracking
						delete visibleRepeaters[`${field.key}-${index}`]
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
