<script context="module">
	import { writable } from 'svelte/store';

	export const modal = writable(null);
</script>

<script>
	import { fade } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
</script>

<div id="modal" class="primo-reset" role="dialog" transition:fade={{ duration: 100 }}>
	<button class="background" aria-label="close dialog" on:click={() => dispatch('close')} />
	<div class="container">
		<slot />
	</div>
</div>

<style>
	#modal {
		position: fixed;
		inset: 0;
		overflow: scroll;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		justify-content: center;
		align-items: var(--Modal-align-items, flex-start);
		z-index: 99;
		box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.08);
		padding: clamp(2rem, 10vw, 50px);
	}

	.background {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.container {
		position: relative;
		z-index: 2;
		background: #fff;
		padding: var(--Modal-padding, 32px 48px);
		border-radius: 4px;
		width: 100%;
		max-width: var(--Modal-max-width, 1000px);
	}
</style>
