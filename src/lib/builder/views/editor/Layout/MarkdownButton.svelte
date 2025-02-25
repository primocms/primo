<script>
	import Icon from '@iconify/svelte'
	/**
	 * @typedef {Object} Props
	 * @property {string} icon
	 * @property {boolean} [active]
	 * @property {() => void} onclick
	 */

	/** @type {Props} */
	let { icon, active = false, onclick } = $props()
</script>

<button {onclick} class:active class="MarkdownButton">
	<Icon {icon} />
</button>

<style lang="postcss">
	.MarkdownButton {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.75rem;
		transition: var(--transition-colors);
		font-size: 0.825rem;

		&:hover {
			background: var(--weave-primary-color);
			color: var(--color-gray-1);
		}

		&.active {
			background: var(--weave-primary-color);
			color: var(--primo-color-white);
		}
	}
</style>
