<script>
	import { createEventDispatcher, onMount } from 'svelte'
	const dispatch = createEventDispatcher()

	onMount(() => {
		dispatch('mount')
	})
</script>

<div class="SymbolPalette">This is a place you can drag any available blocks onto your page.</div>

<style>
	.SymbolPalette {
		min-height: 500px;
		display: flex;
		justify-content: center;
		align-items: center;
		background: var(--color-gray-1);
		border: 3px dashed var(--color-gray-3);
	}
</style>
