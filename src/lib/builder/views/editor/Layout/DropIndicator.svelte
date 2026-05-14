<script>
	let { node = $bindable() } = $props()
</script>

<div bind:this={node} class="DropIndicator"></div>

<style>
	.DropIndicator {
		z-index: 999999;
		position: fixed;
		pointer-events: none;
		height: 4px;
		background: var(--primo-primary-color);
		border-radius: 2px;
		box-shadow: 0 0 8px rgba(248, 68, 73, 0.4);
	}
</style>
