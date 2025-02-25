<script>
	import Icon from '@iconify/svelte'
	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	import UI from '../../ui/index.js'
	import fieldTypes from '../../stores/app/fieldTypes.js'

	let { field, field_to_compare, comparable_fields, collapsed } = $props()

	let condition = $derived(field.options.condition)

	const comparisons = [
		{ icon: 'ph:equals-bold', label: 'Equals', value: '=' },
		{ icon: 'ph:not-equals-bold', label: `Doesn't equal`, value: '!=' }
	]

	function dispatch_update(props) {
		dispatch('input', { ...condition, ...props })
	}

	function delete_condition() {
		dispatch('input', null)
	}
</script>

<div class="Condition" class:collapsed>
	<span class="primo--field-label">Show if</span>
	<div class="container">
		<!-- Sibling field to compare to -->
		<UI.Select
			fallback_label="Field"
			on:input={({ detail: field_id }) => {
				let default_value = ''
				const selected_field = comparable_fields.find((f) => f.id === field_id)
				if (selected_field.type === 'select') {
					default_value = selected_field.options.options[0]?.value
				} else {
					default_value = selected_field.value
				}
				dispatch_update({ field: field_id, value: default_value })
			}}
			value={condition.field}
			options={comparable_fields.map((f) => ({
				icon: $fieldTypes.find((t) => t.id === f.type).icon,
				label: f.label,
				value: f.id,
				disabled: f.options.condition
			}))}
		/>
		<!-- Comparison -->
		<UI.Select on:input={({ detail: comparison }) => dispatch_update({ comparison })} value={condition.comparison} options={comparisons} />
		<!-- Value -->
		{#if field_to_compare?.type === 'select'}
			<UI.Select fullwidth={true} value={condition.value} on:input={({ detail: value }) => dispatch_update({ value })} options={field_to_compare.options?.options || []} />
		{:else if field_to_compare?.type === 'switch'}
			<UI.Toggle
				toggled={condition.value}
				hideLabel={true}
				on:toggle={({ detail }) => {
					dispatch_update({ value: detail })
				}}
			/>
		{:else}
			<UI.TextInput placeholder="Value" value={condition.value || ''} oninput={(value) => dispatch_update({ value })} />
		{/if}
		<!-- Delete -->
		<button class="delete" onclick={delete_condition}>
			<Icon icon="ion:trash" />
		</button>
	</div>
</div>

<style lang="postcss">
	.collapsed .container {
		grid-template-columns: 1fr !important;
		gap: 0.75rem;
	}
	.container {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		gap: 0.5rem;
		/* place-items: center; */
	}
	.delete {
		height: 100%;
		padding: 10px;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		color: var(--primo-color-danger);
		justify-self: flex-start;

		&:hover {
			/* border: 1px solid #c62828; */
			transition: 0.1s;
			background: var(--primo-color-danger);
			color: white;
		}
	}
</style>
