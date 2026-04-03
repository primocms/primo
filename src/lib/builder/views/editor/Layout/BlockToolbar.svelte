<script>
	import { browser } from '$app/environment'
	import { createEventDispatcher } from 'svelte'
	import { debugging_context } from '$lib/builder/stores/context'
	import { fade } from 'svelte/transition'
	import { mod_key_held } from '../../../stores/app/misc'
	import { click_to_copy } from '../../../utilities'
	import Icon from '@iconify/svelte'
	import { current_user } from '$lib/pocketbase/user'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { site_context } from '$lib/builder/stores/context'
	import { page as pageState } from '$app/state'

	const dispatch = createEventDispatcher()
	const { value: site } = site_context.getOr({ value: null })

	/**
	 * @typedef {Object} Props
	 * @property {any} id
	 * @property {any} i
	 * @property {any} [node]
	 * @property {boolean} [immovable]
	 * @property {null|string} [layout_zone]
	 * @property {boolean} [is_last]
	 * @property {'page' | 'page-type'} [context]
	 * @property {any} [page_type]
	 */

	/** @type {Props} */
	let { id, i, node = $bindable(), layout_zone = null, immovable = false, is_last = false, page_type } = $props()

	let isFirst = $derived(i === 0)

	let DEBUGGING = $state()
	if (browser) DEBUGGING = debugging_context.getOr(false)

	const base_path = $state(pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site')
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div in:fade={{ duration: 100 }} class="BlockToolbar primo-reset" bind:this={node}>
	<div class="top">
		{#if layout_zone}
			<Tooltip.Provider delayDuration={100} disableHoverableContent={true}>
				<Tooltip.Root>
					<Tooltip.Trigger class="h-full">
						<div class="component-button">
							{@render EditingButtons()}

							<svelte:element
								this={$current_user?.siteRole === 'developer' ? 'a' : 'div'}
								href="{base_path}/page-type--{page_type.id}"
								class="{$current_user?.siteRole === 'developer'
									? 'hover:bg-[#292929] hover:color-[#E7E7E7l]'
									: ''} pointer-events-auto cursor-auto h-full flex items-center gap-2 bg-[var(--primo-color-codeblack)] px-3 py-1 border-l border-[#111] rounded-br-lg"
							>
								<div class="rounded-full p-1" style="background: {page_type.color}">
									<Icon icon={page_type.icon} />
								</div>
								<span class="text-xs font-normal">{layout_zone === 'header' ? 'Header' : 'Footer'}</span>
							</svelte:element>
						</div>
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom" align="start">
						Content changes will apply to all <strong>{page_type.name}</strong>
						pages
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{:else}
			<div class="component-button">
				{@render EditingButtons()}
			</div>
		{/if}
		{#if !immovable}
			<div class="top-right">
				<button onclick={() => dispatch('delete')} class="button-delete">
					<Icon icon="ion:trash" />
				</button>
				{#if !isFirst}
					<button onclick={() => dispatch('moveUp')}>
						<Icon icon="heroicons-outline:chevron-up" />
					</button>
				{/if}
			</div>
		{/if}
	</div>
	{#if !immovable}
		<div class="bottom">
			{#if !is_last}
				<button class="bottom-right" onclick={() => dispatch('moveDown')}>
					<Icon icon="heroicons-outline:chevron-down" />
				</button>
			{/if}
		</div>
	{/if}
</div>

{#snippet EditingButtons()}
	{#if $current_user?.siteRole === 'developer'}
		<button
			class:showing_key_hint={$mod_key_held}
			onclick={() => {
				dispatch('edit-code')
			}}
			aria-label="Edit Block Code"
		>
			{#if $mod_key_held}
				<span class="key-hint">&#8984; E</span>
			{/if}
			<span class="icon">
				<Icon icon="ph:code-bold" />
			</span>
		</button>
	{/if}
	<button onclick={() => dispatch('edit-content')} aria-label="Edit Block Content">
		<span class="icon">
			<Icon icon="material-symbols:edit-square-outline-rounded" />
		</span>
		{#if $current_user?.siteRole !== 'developer'}
			<span class="text-xs font-normal">Edit Content</span>
		{/if}
	</button>
	{#if $current_user?.siteRole === 'developer' && browser && window.location.hostname === 'localhost'}
		<Tooltip.Provider delayDuration={100} disableHoverableContent={true}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<button class="block-id" use:click_to_copy aria-label="Copy block ID">
						<Icon icon="ph:copy" />
					</button>
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom">
					Copy block ID: {id}
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/if}
{/snippet}

<style lang="postcss">
	.BlockToolbar {
		box-shadow: inset 0 0 0 4px var(--color-gray-8);
		z-index: 999;
		position: fixed;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		font-size: 0.875rem;
	}
	.component-button {
		height: 100%;
		display: flex;
		left: 0px;

		button {
			display: flex;
			font-size: 0.875rem;
			gap: 0.25rem;
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
		/* height: 2rem; */
		/* color: var(--primo-color-white); */
		/* background-color: var(--primo-color-black-opaque); */
		background: var(--primo-color-codeblack);
		color: white;

		/* font-size: var(--font-size-2); */
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
			z-index: 1; /* show full shadow */
			/* box-shadow: var(--primo-ring); */
			/* background: var(--pala-primary-color); */
			/* color: var(--colr-gray-9); */
			background: #292929;
			color: #E7E7E7l;
		}
	}
	button:focus {
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	.top {
		display: flex;
		justify-content: space-between;
		/* position: absolute;
		top: 0;
		left: 0;
		right: 0; */
	}
	.bottom {
		display: flex;
		justify-content: flex-end;
		/* width: 100%; */
		/* bottom: 0px;
		right: 0px;
		position: absolute; */
	}
</style>
