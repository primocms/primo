<script>
	import { createEventDispatcher, onMount } from 'svelte'
	const dispatch = createEventDispatcher()

	onMount(() => {
		dispatch('mount')
	})
</script>

<div class="SymbolPalette">This is the drop zone for Blocks toggled for this Page Type. Drag any Blocks above or below this section that you want to appear on every page of this type.</div>

<style>
	.SymbolPalette {
		line-height: 1.5rem;
		color: var(--color-gray-6);
		font-size: 0.875rem;
		padding: 20%;
		text-align: center;
		min-height: 500px;
		display: flex;
		justify-content: center;
		align-items: center;
		background: var(--color-gray-1);
		border: 3px dashed var(--color-gray-3);
		font-family: sans-serif;
	}
</style>
