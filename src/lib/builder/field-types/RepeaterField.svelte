<script module>
	import { writable } from 'svelte/store'
	export const pluralize = writable(null)
	import('../libraries/pluralize').then((mod) => pluralize.set(mod.default))
</script>

<script>
	import { flip } from 'svelte/animate'
	import { find as _find, chain as _chain, cloneDeep as _cloneDeep } from 'lodash-es'
	import Icon from '@iconify/svelte'
	import { createEventDispatcher, onDestroy, tick } from 'svelte'
	import RepeaterFieldItem from './RepeaterFieldItem.svelte'

	import * as idb from 'idb-keyval'
	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} id
	 * @property {any} field
	 * @property {any} fields
	 * @property {any} entries
	 * @property {number} [level]
	 * @property {boolean} [show_label]
	 */

	/** @type {Props} */
	let { id, field, fields, entries, level = 0, show_label = false, oninput } = $props()

	let subfields = $derived(fields.filter((f) => f.parent === field.id).sort((a, b) => a.index - b.index))
	let repeater_entries = $derived(entries.filter((r) => r.parent === id))

	let repeater_item_just_created = $state(null) // to autofocus on creation
	async function add_item() {
		const n_sibling_entries = repeater_entries.length
		repeater_item_just_created = n_sibling_entries
		await tick()
		dispatch('add', { parent: id, index: repeater_entries.length, subfields })
		visibleRepeaters[`${field.key}-${repeater_entries.length - 1}`] = true
	}

	let visibleRepeaters = $state({})

	idb.get(field.id).then((res) => {
		if (res) {
			visibleRepeaters = res
		}
	})

	onDestroy(() => {
		// save visible repeaters
		idb.set(field.id, _cloneDeep(visibleRepeaters))
	})

	let hover_index = $state(null)
	let hover_position = $state(null)
</script>

<div class="RepeaterField repeater-level-{level}">
	{#if show_label}
		<p class="primo--field-label">{field.label}</p>
	{/if}
	<ul class="fields">
		{#each repeater_entries.sort((a, b) => a.index - b.index) as repeater_item, index (repeater_item.id)}
			{@const subfield_id = `${field.key}-${index}`}
			{@const autofocus = index === repeater_item_just_created}
			{@const hovering = hover_index === index}
			<li>
				<RepeaterFieldItem
					{repeater_item}
					{field}
					{index}
					{subfields}
					{fields}
					{entries}
					{level}
					{autofocus}
					{oninput}
					is_visible={visibleRepeaters[subfield_id]}
					on:toggle={() => (visibleRepeaters[subfield_id] = !visibleRepeaters[subfield_id])}
					on:hover={({ detail }) => {
						hover_index = index
						hover_position = detail
					}}
					{hovering}
					{hover_position}
					on:move
					on:remove
					on:keydown
					on:add
				/>
			</li>
		{/each}
	</ul>
	<button class="field-button" onclick={add_item}>
		<Icon icon="akar-icons:plus" />
		<span>Create {$pluralize ? $pluralize.singular(field.label) : field.label}</span>
	</button>
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
		background: #1f1f1f;
		color: var(--button-color);
		transition:
			background 0.1s,
			color 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: var(--font-size-2);
		padding: 0.5rem;
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
