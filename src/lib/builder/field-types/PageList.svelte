<script>
	import page_types from '$lib/builder/stores/data/page_types'
	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	let { field, value } = $props()

	const selected_page_type = $page_types.find((pt) => pt.id === field.options.page_type)
</script>

{#if selected_page_type}
	<div>A list of {selected_page_type.name} pages</div>
{:else}
	<div>No page connected</div>
{/if}

<style lang="postcss">
	div {
		font-size: 0.875rem;
	}
</style>
