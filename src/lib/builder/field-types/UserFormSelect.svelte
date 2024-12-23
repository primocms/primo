<script>
	import { cloneDeep } from 'lodash-es'
	import { dataChanged } from '../database'
	import { createEventDispatcher } from 'svelte'
	import { site } from '../stores/data/site'

	const dispatch = createEventDispatcher()

	let forms = $state([])

	dataChanged({
		table: 'forms',
		action: 'select',
		data: 'button, error_message, success_message, name, id, fields',
		match: {
			site: $site.id
		}
	}).then((res) => {
		forms = cloneDeep(res)
	})

	let { field = $bindable() } = $props();
</script>

<div class="label-container">
	<label for={field.key}>
		<span>{field.label}</span>
		{#if forms.length > 0}
			<select
				value={field.value.id}
				onchange={({ target }) => {
					const form = forms.find((f) => f.id === target.value)
					field.value = form
					field.options.id = form.id // to keep ID at symbol level (since value isn't saved to field)
					dispatch('input')
				}}
			>
				{#each forms as form}
					<option value={form.id}>{form.name}</option>
				{/each}
			</select>
		{:else}
			<span>You don't have any forms</span>
		{/if}
	</label>
</div>

<style lang="postcss">
	.label-container {
		width: 100%;

		label {
			display: grid;
			gap: 0.75rem;

			span {
				font-weight: var(--label-font-weight, 700);
				font-size: var(--label-font-size, 1rem);
			}

			select {
				border: 1px solid var(--color-gray-8);
				background: transparent;
				border-radius: var(--primo-border-radius);
				padding: 0.25rem 0.5rem;

				&:focus {
					outline: 1px solid var(--primo-color-brand);
				}
			}
		}
	}
</style>
