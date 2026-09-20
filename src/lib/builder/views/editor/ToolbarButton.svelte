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
	title={title || undefined}
	aria-label={label || title || undefined}
	aria-busy={loading}
	class="primo-button"
	class:primo={type === 'primo'}
	class:active
	class:has-subbuttons={buttons}
	class:has-icon-button={!label && icon}
	{style}
	disabled={disabled || loading}
	onclick={() => {
		subButtonsActive = !subButtonsActive
		onclick ? onclick() : dispatch('click')
	}}
>
	{#if icon || svg}
		{#if loading}
			<UI.Spinner />
		{:else if label && svg}
			<div class="svg" class:invisible={key && $mod_key_held}>
				{@html svg}
			</div>
			<span class="label" class:invisible={key && $mod_key_held}>{label}</span>
		{:else if label && icon}
			<Icon {icon} class={key && $mod_key_held ? 'invisible' : ''} />
			<span class="label" class:invisible={key && $mod_key_held}>{label}</span>
		{:else if svg}
			<div class="svg" class:invisible={key && $mod_key_held}>
				{@html svg}
			</div>
		{:else if icon}
			<Icon {icon} class={key && $mod_key_held ? 'invisible' : ''} />
		{/if}
		{#if key && $mod_key_held && !loading}
			<span class="key-hint" aria-hidden="true">
				&#8984;{key.toUpperCase()}
			</span>
		{/if}
	{:else if children}{@render children()}{:else}
		<span>{label}</span>
	{/if}
</button>

<style lang="postcss">
	.primo-button {
		--Spinner-size: 0.75rem;
		position: relative;
		white-space: nowrap;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		min-height: 32px;
		height: 100%;
		padding: 7px 11px;
		border-radius: 6px;
		color: #dedee3;
		font-size: 12px;
		font-weight: 500;
		line-height: 18px;
		user-select: none;
		transition:
			background-color 0.15s,
			color 0.15s;
		&:hover,
		&.active {
			background: #303034;
			color: white;
		}
		&:focus-visible {
			outline: 2px solid #c4c4ce;
			outline-offset: 3px;
		}
		&:active {
			background: #3b3b40;
		}
		&[disabled] {
			opacity: 0.45;
			cursor: default;
			pointer-events: none;
		}
		:global(svg) {
			width: 14px;
			height: 14px;
			flex-shrink: 0;
		}
	}
	.primo-button.primo {
		padding-inline: 14px;
		background: #ededf0;
		color: #202023;
		box-shadow: 0 1px 2px #0003;
		&:hover {
			background: white;
			color: #111113;
		}
		&:active {
			background: #d4d4da;
		}
	}
	.key-hint {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		pointer-events: none;
		white-space: nowrap;
	}
</style>
