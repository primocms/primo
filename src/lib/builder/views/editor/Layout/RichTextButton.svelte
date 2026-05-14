<script lang="ts">
	import Icon from '@iconify/svelte'

	/**
	 * @typedef {Object} Props
	 * @property {string} icon
	 * @property {boolean} [active]
	 * @property {boolean} [disabled]
	 * @property {() => void} onclick
	 * @property {string} [aria_label]
	 */

	/** @type {Props} */
	let { icon, active = false, disabled = false, onclick, aria_label } = $props()
</script>

<button {onclick} class:active class:disabled class="RichTextButton" {disabled} aria-label={aria_label}>
	<Icon {icon} width="15" height="15" />
</button>

<style lang="postcss">
	.RichTextButton {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.75rem;
		transition: var(--transition-colors);
		font-size: 0.825rem;

		&:hover:not(.disabled) {
			background: var(--primo-primary-color);
			color: var(--color-gray-1);
		}

		&.active:not(:hover) {
			background: initial;
			color: var(--primo-primary-color);
		}

		&.disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
</style>
