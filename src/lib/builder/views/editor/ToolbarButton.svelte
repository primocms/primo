<script>
	import { createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import UI from '../../ui'
	import { mod_key_held } from '../../stores/app/misc'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} [id]
	 * @property {string} [title]
	 * @property {string | null} [label]
	 * @property {any} [key]
	 * @property {any} [icon]
	 * @property {any} [svg]
	 * @property {boolean} [disabled]
	 * @property {any} [onclick]
	 * @property {boolean} [loading]
	 * @property {boolean} [active]
	 * @property {any} [buttons]
	 * @property {any} [type]
	 * @property {string} [style]
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let {
		id = null,
		title = '',
		label = null,
		key = null,
		icon = null,
		svg = null,
		disabled = false,
		onclick = null,
		loading = false,
		active = false,
		buttons = null,
		type = null,
		style = '',
		children
	} = $props()

	let subButtonsActive = $state(false)
</script>

<button
	{id}
	aria-label={title}
	class="primo-button"
	class:primo={type === 'primo'}
	class:active
	class:has-subbuttons={buttons}
	class:has-icon-button={!label && icon}
	{style}
	{disabled}
	onclick={() => {
		subButtonsActive = !subButtonsActive
		onclick ? onclick() : dispatch('click')
	}}
>
	{#if icon || svg}
		{#if key}
			<span class="key-hint" class:active={$mod_key_held} aria-hidden>
				&#8984;{key.toUpperCase()}
			</span>
		{/if}
		{#if loading}
			<UI.Spinner />
		{:else if label && svg}
			<div class="svg">
				{@html svg}
			</div>
			<span class="label">{label}</span>
		{:else if label && icon}
			<Icon {icon} />
			<span class="label">{label}</span>
		{:else if svg}
			<div class="svg">
				{@html svg}
			</div>
		{:else if icon}
			<Icon {icon} />
		{/if}
	{:else if children}{@render children()}{:else}
		<span>{label}</span>
	{/if}
</button>

<style lang="postcss">
	/* @tailwind base; */

	.primo-button {
		font-size: 0.85rem;
		user-select: none;
		/* border: 1px solid var(--color-gray-8); */
		--Spinner-size: 0.75rem;

		/* &:first-child {
      border-top-left-radius: var(--primo-border-radius);
      border-bottom-left-radius: var(--primo-border-radius);
    }

    &:last-child {
      border-top-right-radius: var(--primo-border-radius);
      border-bottom-right-radius: var(--primo-border-radius);
    } */

		&[disabled] {
			background: none;
			opacity: 0.35;
			pointer-events: none;
		}
	}

	.primo-button.primo {
		box-shadow: var(--primo-ring-thin);
		color: var(--primo-color-white);
		transition: 0.1s;
		/* border: 1.5px solid var(--weave-primary-color); */
		/* border-radius: 0.25rem; */

		&:hover {
			background: var(--weave-primary-color);
			color: white;
		}
	}

	.primo-button {
		padding: 6px 10px;
		border-radius: 2px;
		color: var(--primo-color-white);
		font-weight: 400;
		font-size: 0.75rem;
		height: 100%;
		transition: 0.1s box-shadow;
		outline: 0;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;

		&.has-icon-button {
			/* padding: 10px; */

			:global(svg) {
				width: 1rem;
				height: auto;
			}
		}

		&:hover,
		&:focus {
			/* background: var(--primo-color-codeblack); */
			background: #1f1f1f;
			/* z-index: 2; */
		}

		&:active {
			background: #404040;
			/* box-shadow: var(--primo-ring); */
			/* background: var(--weave-primary-color); */
			/* color: var(--color-gray-8); */
		}
	}

	.primo-button[disabled] {
		opacity: 0.1;
		cursor: default;
		transition: var(--transition-colors);

		&:hover,
		&:focus {
			box-shadow: none;
		}
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
