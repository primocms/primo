<script>
	import { createEventDispatcher } from 'svelte'
	import ToggleCore from './ToggleCore.svelte'
	/**
	 * @typedef {Object} Props
	 * @property {boolean} [toggled] - Specify whether the toggle switch is toggled
	 * @property {string} [label] - Specify the label text
	 * @property {boolean} [hideLabel] - Set to `true` to visually hide the label
	 * @property {boolean} [small] - Set to `true` to use the small variant
	 * @property {boolean} [disabled] - Set to `true` to disable the button
	 * @property {string} [on] - Set a descriptor for the toggled state
	 * @property {string} [off] - Set a descriptor for the untoggled state
	 * @property {string} [switchColor] - Specify the switch color
	 * @property {string} [toggledColor] - Specify the toggled switch background color
	 * @property {string} [untoggledColor] - Specify the untoggled switch background color
	 * @property {import('svelte').Snippet<[any]>} [children]
	 */

	/** @type {Props & { [key: string]: any }} */
	let {
		toggled = $bindable(true),
		label = '',
		hideLabel = false,
		small = false,
		disabled = false,
		on = undefined,
		off = undefined,
		switchColor = '#fff',
		toggledColor = '#0f62fe',
		untoggledColor = '#8d8d8d',
		children,
		...rest
	} = $props()

	const dispatch = createEventDispatcher()
</script>

<ToggleCore bind:toggled>
	{#snippet children({ label: labelProps, button })}
		<!-- svelte-ignore a11y_label_has_associated_control -->
		<label {...labelProps} class:hideLabel>{label}</label>
		<div>
			<button
				class:small
				{...rest}
				{...button}
				style="color: {switchColor}; background-color: {toggled ? toggledColor : untoggledColor};
	      {rest.style}"
				{disabled}
				aria-label={label}
				onclick={() => dispatch('toggle', !toggled)}
				{onfocus}
				{onblur}
			></button>
			{#if children}{@render children({ toggled })}{:else if on && off}<span>{toggled ? on : off}</span>{/if}
		</div>
	{/snippet}
</ToggleCore>

<style>
	label {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
	}

	/**
  * Visually hide element without breaking screen readers
  * https://a11yproject.com/posts/how-to-hide-content/
  */
	.hideLabel {
		position: absolute;
		height: 1px;
		width: 1px;
		overflow: hidden;
		clip: rect(1px 1px 1px 1px);
		clip: rect(1px, 1px, 1px, 1px);
		white-space: nowrap;
	}

	button {
		position: relative;
		padding: 0 0.25rem;
		border: 0;
		border-radius: 1rem;
		height: 1.25rem;
		width: 2.5rem;
		/* height: 0.875rem;
		width: 1.5rem; */
		font: inherit;
		/* color: inherit; */
		line-height: inherit;
	}

	button:not([disabled]) {
		cursor: pointer;
	}

	button[disabled] {
		cursor: not-allowed;
		opacity: 0.6;
	}

	button:before {
		position: absolute;
		content: '';
		top: 0;
		bottom: 0;
		left: 0.125rem;
		/* left: 1px; */
		margin: auto;
		height: 1rem;
		width: 1rem;
		/* height: 0.75rem;
		width: 0.75rem; */
		text-align: center;
		border-radius: 50%;
		background-color: currentColor;
		transition: transform 150ms ease-out;
	}

	button[aria-checked='true']:before {
		transform: translateX(1.25rem);
	}

	button.small {
		height: 1rem;
		width: 1.75rem;
	}

	button.small:before {
		height: 0.75rem;
		width: 0.75rem;
	}

	button.small[aria-checked='true']:before {
		transform: translateX(0.75rem);
	}

	div {
		display: flex;
		align-items: center;
	}

	span {
		margin-left: 0.5rem;
	}
</style>
