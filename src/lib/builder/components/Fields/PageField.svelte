<script>
	import { onMount } from 'svelte'
	import UI from '../../ui/index.js'
	import page_types from '../../stores/data/page_types.js'

	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	let { field } = $props()

	let selected_page_type = $state(field.options.page_type)

	let field_synced_with_other_page_type = false

	onMount(() => {
		// set initial value
		if (!selected_page_type) dispatch('input', { ...field.options, page_type: $page_types[0].id })
	})
</script>

<div class="PagesField">
	{#if field_synced_with_other_page_type}
		<div>
			<p>
				Synced with {'{page_type}'}. Is hidden. Will fall back to other field.
			</p>
		</div>
	{:else}
		<div class="container">
			<!-- Entity type -->
			<UI.Select
				on:input={({ detail }) => {
					selected_page_type = detail
					dispatch('input', { ...field.options, page_type: detail })
				}}
				label="Page Type"
				value={selected_page_type}
				fullwidth={true}
				options={$page_types.map((page_type) => ({
					label: page_type.name,
					value: page_type.id,
					icon: page_type.icon
				}))}
			/>
		</div>
	{/if}
</div>

<style>
	.container {
		display: grid;
		gap: 0.5rem;
	}
</style>
