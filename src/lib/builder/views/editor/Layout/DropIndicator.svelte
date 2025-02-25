<script>
	let { node = $bindable() } = $props()
</script>

<div bind:this={node} class="DropIndicator"></div>

<style>
	.DropIndicator {
		border: 0.25rem solid var(--weave-primary-color);
		/* box-shadow: inset 0 0 0 calc(4px) var(--color-gray-8); */
		z-index: 999999;
		position: fixed;
		pointer-events: none;
		display: flex;
		justify-content: space-between;
		flex-direction: column;
		font-size: 0.875rem;
	}
</style>
