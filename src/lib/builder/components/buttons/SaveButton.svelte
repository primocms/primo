<script>
	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	import UI from '../../ui'

	/**
	 * @typedef {Object} Props
	 * @property {string} [variants]
	 * @property {string} [type]
	 * @property {boolean} [disabled]
	 * @property {boolean} [loading]
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { variants = '', type = 'button', disabled = false, loading = false, children } = $props()
</script>

<button class={variants} class:disabled={disabled || loading} disabled={disabled || loading} onclick={(e) => dispatch('click', e)} {type}>
	{#if loading}
		<UI.Spinner />
	{:else}
		{@render children?.()}
	{/if}
</button>

<style lang="postcss">
	button {
		background: var(--weave-primary-color);
		color: var(--primo-color-black);
		padding: 0.5rem 1rem;
		border-radius: var(--primo-border-radius);
		font-weight: 600;
		transition:
			background 0.1s,
			color 0.1s;

		&:hover {
			background: var(--weave-primary-color-dark);
			color: var(--primo-color-white);
		}

		&.disabled {
			background: var(--color-gray-6);
			color: var(--color-gray-9);
		}
	}
</style>
