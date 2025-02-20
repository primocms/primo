<script>
	import Icon from '@iconify/svelte'
	import { fade } from 'svelte/transition'
	import { createEventDispatcher } from 'svelte'
	import { mod_key_held } from '../stores/app/misc.js'
	import hotkey_events from '../stores/app/hotkey_events.js'
	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} [active_tab_id] - export let tabs
	 * @property {string} [variant]
	 * @property {boolean} [disable_hotkeys]
	 * @property {string} [style]
	 */

	/** @type {Props} */
	let { active_tab_id = $bindable(tabs[0]?.id), variant = 'primary', disable_hotkeys = false, style = '' } = $props()

	hotkey_events.on('e', toggle_switch)

	function toggle_switch() {
		if (active_tab_id === 'code') {
			active_tab_id = 'content'
		} else {
			active_tab_id = 'code'
		}
	}

	$effect(() => {
		dispatch('switch', active_tab_id)
	})
</script>

<div class="LargeSwitch {variant}" in:fade={{ duration: 200 }} {style}>
	<button onclick={toggle_switch}>
		<div class="half" class:active={active_tab_id === 'code'} class:showing_key_hint={$mod_key_held && !disable_hotkeys && active_tab_id !== 'code'}>
			{#if $mod_key_held && !disable_hotkeys && active_tab_id !== 'code'}
				<span class="key-hint">&#8984; E</span>
			{/if}
			<span class="label">
				<Icon icon="gravity-ui:code" />
			</span>
		</div>
		<div class="half" class:active={active_tab_id === 'content'} class:showing_key_hint={$mod_key_held && !disable_hotkeys && active_tab_id !== 'content'}>
			{#if $mod_key_held && !disable_hotkeys && active_tab_id !== 'content'}
				<span class="key-hint">&#8984; E</span>
			{/if}
			<span class="label">
				<Icon icon="uil:edit" />
			</span>
		</div>
		<span class="toggle-back" style:transform={active_tab_id === 'code' ? '' : 'translateX(calc(100% + 6px))'}></span>
	</button>
</div>

<style lang="postcss">
	.LargeSwitch {
		margin: auto 0.5rem;
		font-size: 14px;
	}
	.toggle-back {
		position: absolute;
		border-radius: 50%;
		aspect-ratio: 1;
		inset: initial;
		left: 3px;
		width: 30px;
		top: 2px;
		background: var(--color-gray-8);
		/* border: 1px solid var(--weave-primary-color); */
		transition: 0.1s;
		z-index: 0;
	}
	button {
		margin: auto 0.5rem;
		display: flex;
		justify-content: center;
		color: white;
		font-size: 0.875rem;
		position: relative;
		border: 1px solid var(--color-gray-8);
		border-radius: 2rem;
	}

	.half {
		flex: 1;
		padding: 10px 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		color: var(--color-gray-4);
		position: relative;
		z-index: 1;
		/* border: 1px solid var(--color-gray-8); */
		transition: 0.1s;

		&:first-child {
			border-right: 0;
		}

		&:focus-visible {
			outline: 1px solid var(--weave-primary-color);
		}

		&.active {
			color: white;
			/* border-bottom-color: var(--weave-primary-color); */
		}

		&.showing_key_hint .label {
			visibility: hidden;
		}

		.key-hint {
			font-size: 12px;
			position: absolute;
		}

		.label {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}
	}
</style>
