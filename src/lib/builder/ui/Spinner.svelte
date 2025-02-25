<script>
	import Icon from '@iconify/svelte'

	/**
	 * @typedef {Object} Props
	 * @property {string} [variant]
	 */

	/** @type {Props} */
	let { variant = 'dots' } = $props()

	const icon = {
		dots: 'eos-icons:three-dots-loading',
		loop: 'line-md:loading-twotone-loop'
	}[variant]
</script>

<div class="Spinner">
	<Icon {icon} />
</div>

<style>
	.Spinner {
		color: var(--Spinner-color);
		font-size: var(--Spinner-font-size);
		padding: var(--Spinner-padding);
	}
</style>
