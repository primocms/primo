<script lang="ts">
	import { find as _find, chain as _chain } from 'lodash-es'
	import Icon from '@iconify/svelte'
	import { fieldTypes } from '../stores/app'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Field } from '$lib/common/models/Field'
	import type { Entity } from '$lib/Entity'
	import type { Component } from 'svelte'
	import type { FieldValueHandler, FieldValueMap } from '../components/Fields/FieldsContent.svelte'
	import EntryContent from '../components/Fields/EntryContent.svelte'

	const {
		entity,
		field,
		entry,
		fields,
		entries,
		onchange,
		ondelete,
		level
	}: {
		entity: Entity
		field: Field
		entry?: Entry
		fields: Field[]
		entries: Entry[]
		onchange: FieldValueHandler
		ondelete: (entry_id: string) => void
		level: number
	} = $props()

	const group_entry = $derived(entry)
	const subfields = $derived(fields.filter((f) => f.parent === field.id).sort((a, b) => a.index - b.index))

	let hidden = $state(false)
</script>

<div class="group-field group-level-{level}">
	{#if level > 0}
		<button onclick={() => (hidden = !hidden)}>
			<span>{field.label}</span>
			<Icon icon={hidden ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} />
		</button>
	{/if}
	{#if !hidden}
		<div class="group-entries">
			{#if subfields.length === 0}
				<div class="no-subfields">
					<span>No subfields in this group. Add subfields in the Field tab.</span>
				</div>
			{:else}
				{#each subfields as subfield (subfield.id)}
					<EntryContent
						{entity}
						parent={group_entry}
						field={subfield}
						{fields}
						{entries}
						level={level + 1}
						minimal={true}
						onchange={(values) => onchange({ [field.key]: { 0: { value: null, subValues: values } } })}
						{ondelete}
					/>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style lang="postcss">
	.group-field {
		display: grid;
		/* gap: 0.75rem; */
	}
	button {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.5rem;
		padding-left: 0;

		span {
			font-size: var(--title-font-size);
			font-weight: var(--title-font-size);
		}

		& + .group-entries {
			border-top: var(--input-border);
			/* padding-top: 2rem; */
			padding-top: 1rem;
		}
	}
	.group-level-1 {
		padding-left: 1.5rem;
		border-left: 0.5rem solid var(--field-border-color, #252627);
	}
	.group-item {
		/* background: var(--color-gray-9); */
		margin-bottom: 0.25rem;

		&:only-child {
			padding: 0.5rem;
		}

		padding-left: 0;
		--label-font-size: 0.75rem;
		--label-font-weight: 400;
	}

	.group-entries {
		display: grid;
		gap: 1rem;
	}
</style>
