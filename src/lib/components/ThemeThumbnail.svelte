<script>
	import { fade } from 'svelte/transition'
	import { createEventDispatcher } from 'svelte'
	import SiteThumbnail from './SiteThumbnail.svelte'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} preview
	 * @property {string} [append]
	 * @property {any} title
	 * @property {boolean} [selected]
	 */

	/** @type {Props} */
	let {
		preview,
		append = '',
		title,
		selected = $bindable(false)
	} = $props();
</script>

<button
	class="theme-thumbnail"
	class:selected
	type="button"
	in:fade={{ duration: 100 }}
	onclick={() => {
		selected = true
		dispatch('click')
	}}
>
	<!-- <img src={preview} alt={title} /> -->
	<SiteThumbnail {preview} {append} />
	{#if title}
		<div class="title">{title}</div>
	{/if}
</button>

<style lang="postcss">
	.theme-thumbnail {
		border-radius: var(--primo-border-radius);
		background: var(--color-gray-8);
		overflow: hidden;
		transition: 0.1s box-shadow;
		width: 100%;

		&.selected {
			box-shadow: 0px 0px 0px 2px var(--primo-color-brand);
		}

		&:hover {
			opacity: 0.75;
		}
	}
	.title {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-top: 1px solid var(--color-gray-9);
	}
</style>
