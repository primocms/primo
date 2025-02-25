<script>
	import Icon from '@iconify/svelte'

	/**
	 * @typedef {Object} Props
	 * @property {string} [icon]
	 * @property {any} [color]
	 * @property {() => void} onclick
	 */

	/** @type {Props} */
	let { icon = 'carbon:overflow-menu-vertical', color = null, onclick } = $props()
	let clicked = false
</script>

<button class="show-menu" class:active={clicked} {onclick} style:color>
	<Icon {icon} />
</button>

<style lang="postcss">
	button.show-menu {
		flex: 1;
		padding: 0.25rem;
		transition: 0.1s;
		border-radius: 4px;
		transition: 0.1s;
		/* opacity: 0; */
		opacity: var(--IconButton-opacity, 1);

		&:hover,
		&.active {
			/* background: #f4f4f6; */
			/* opacity: 1; */
		}
	}
</style>
