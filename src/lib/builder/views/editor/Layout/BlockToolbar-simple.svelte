<script>
	import { browser } from '$app/environment'
	import { createEventDispatcher } from 'svelte'
	import { debugging_context } from '$lib/builder/stores/context'
	import { fade } from 'svelte/transition'
	import { mod_key_held } from '../../../stores/app/misc'
	import { click_to_copy } from '../../../utilities'
	import { Code, Edit3, Trash2, ChevronUp, ChevronDown } from 'lucide-svelte'
	import { current_user } from '$lib/pocketbase/user'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} id
	 * @property {any} i
	 * @property {any} [node]
	 * @property {boolean} [is_instance_block]
	 * @property {boolean} [is_last]
	 */

	/** @type {Props} */
	let { id, i, node = $bindable(), is_instance_block = false, is_last = false } = $props()

	let isFirst = $derived(i === 0)

	let DEBUGGING = $state()
	if (browser) DEBUGGING = debugging_context.getOr(false)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div in:fade={{ duration: 100 }} class="BlockToolbar primo-reset" bind:this={node}>
	<div class="top">
		<div class="component-button">
			{#if $current_user?.siteRole === 'developer'}
				<button class:showing_key_hint={$mod_key_held} onclick={() => dispatch('edit-code')} aria-label="Edit Block Code">
					{#if $mod_key_held}
						<span class="key-hint">⌘ E</span>
					{/if}
					<span class="icon">
						<Code size={14} />
					</span>
				</button>
			{/if}
			<button onclick={() => dispatch('edit-content')} aria-label="Edit Block Content">
				<span class="icon">
					<Edit3 size={14} />
				</span>
				{#if $current_user?.siteRole !== 'developer'}
					<span>Edit Content</span>
				{/if}
			</button>
			{#if $current_user?.siteRole === 'developer' && browser && window.location.hostname === 'localhost'}
				<button class="block-id" use:click_to_copy title="Copy block ID: {id}">
					{id}
				</button>
			{/if}
		</div>
		{#if !is_instance_block}
			<div class="top-right">
				<button onclick={() => dispatch('delete')} class="button-delete">
					<Trash2 size={14} />
				</button>
				{#if !isFirst}
					<button onclick={() => dispatch('moveUp')}>
						<ChevronUp size={14} />
					</button>
				{/if}
			</div>
		{/if}
	</div>
	{#if !is_instance_block}
		<div class="bottom">
			{#if !is_last}
				<button class="bottom-right" onclick={() => dispatch('moveDown')}>
					<ChevronDown size={14} />
				</button>
			{/if}
		</div>
	{/if}
</div>

<style lang="postcss">
	.BlockToolbar {
		box-shadow: inset 0 0 0 calc(4px) var(--color-gray-8);
		z-index: 999;
		position: fixed;
		pointer-events: none;
		display: flex;
		justify-content: space-between;
		flex-direction: column;
		font-size: 0.875rem;
	}
	.component-button {
		display: flex;
		left: 0px;

		button {
			display: flex;
			font-size: 0.875rem;
			gap: 0.5rem;
		}

		button:last-child {
			border-bottom-right-radius: 0.25rem;
		}
	}

	.top-right {
		display: flex;
	}

	.block-id {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		pointer-events: all;
		background: rgba(0, 0, 0, 0.9);
		color: white;
		font-size: 0.75rem;
	}

	.button-delete {
		border-bottom-left-radius: 0.25rem;
		padding-left: 0.75rem;
		padding-right: 0.75rem;
	}

	button {
		pointer-events: all;
		padding: 0.5rem 1rem;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 1rem;
		background: var(--primo-color-codeblack);
		color: white;
		font-weight: 500;
		transition:
			background-color 0.1s,
			color 0.1s;
		box-shadow:
			var(--tw-ring-offset-shadow, 0 0 #0000),
			var(--tw-ring-shadow, 0 0 #0000),
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -2px rgba(0, 0, 0, 0.05);

		&.showing_key_hint .icon {
			visibility: hidden;
		}

		.key-hint {
			font-size: 0.75rem;
			position: absolute;
		}

		&:hover {
			z-index: 1;
			background: #292929;
			color: #e7e7e7;
		}
	}
	button:focus {
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	.top {
		display: flex;
		justify-content: space-between;
	}
	.bottom {
		display: flex;
		justify-content: flex-end;
	}
</style>
