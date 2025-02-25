<script>
	import { find as _find, chain as _chain } from 'lodash-es'
	import { createEventDispatcher } from 'svelte'
	import Icon from '@iconify/svelte'
	import { fieldTypes } from '../stores/app'
	import { is_regex } from '../utils'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} id
	 * @property {any} field
	 * @property {any} fields
	 * @property {any} entries
	 * @property {number} [level]
	 * @property {() => void} [oninput]
	 */

	/** @type {Props} */
	let { id, field, fields, entries, level = 0, oninput } = $props()

	let subfields = $derived(fields.filter((f) => f.parent === field.id).sort((a, b) => a.index - b.index))

	let hidden = $state(false)

	function getFieldComponent(subfield) {
		const field = _find($fieldTypes, ['id', subfield.type])
		return field ? field.component : null
	}

	function check_condition(field) {
		if (!field.options.condition) return true // has no condition
		const { field: field_id, value, comparison } = field.options.condition
		const field_to_compare = fields.find((f) => f.id === field_id)
		if (!field_to_compare) {
			// field has been deleted, reset condition
			// field.options.condition = null
			return true
		}
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
			{#each subfields as subfield}
				{@const is_visible = check_condition(subfield)}
				{@const entry = entries.find((e) => e.field === subfield.id && e.parent === id)}
				{#if !entry}
					<span>Field is corrupt ({subfield.key} - {subfield.id})</span>
				{:else if is_visible}
					{@const SvelteComponent = getFieldComponent(subfield)}
					<div class="group-item">
						<SvelteComponent
							id={entry.id}
							value={entry.value}
							metadata={entry.metadata}
							field={subfield}
							{fields}
							{entries}
							level={level + 1}
							on:save
							on:add
							on:remove
							on:move
							oninput={(detail) => {
								if (detail.id) {
									oninput(detail)
									// dispatch('input', detail)
								} else {
									oninput({ id: entry.id, data: detail })
								}
							}}
						/>
					</div>
				{/if}
			{/each}
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
