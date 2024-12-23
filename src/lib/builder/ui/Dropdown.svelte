<script>
	import { createEventDispatcher } from 'svelte'
	import _ from 'lodash-es'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import { clickOutside } from '../utilities'
	import { createPopperActions } from 'svelte-popperjs'
	// import { toast } from '@zerodevx/svelte-toast';

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {string} [label]
	 * @property {string} [icon]
	 * @property {any} [options]
	 * @property {any} [dividers]
	 * @property {string} [placement]
	 * @property {string} [variant]
	 */

	/** @type {Props} */
	let { label = '', icon = 'carbon:overflow-menu-vertical', options = [], dividers = [], placement = 'bottom-start', variant = '' } = $props()

	const [popperRef, popperContent] = createPopperActions({
		placement,
		strategy: 'fixed'
	})

	let showing_dropdown = $state(false)

	let active_submenu = $state(null)
	let selected_submenu_option = $state(null)
</script>

<div class="Dropdown {variant}" use:clickOutside onclick_outside={() => (showing_dropdown = false)} role="menu">
	{#if label}
		<button
			class="primary"
			type="button"
			use:popperRef
			onclick={() => {
				showing_dropdown = !showing_dropdown
			}}
		>
			<Icon {icon} />
			<p>{label}</p>
			<span class="dropdown-icon">
				<Icon icon="mi:select" />
			</span>
		</button>
	{:else}
		<button class="vertical-menu" use:popperRef onclick={() => (showing_dropdown = !showing_dropdown)} type="button">
			<Icon {icon} />
		</button>
	{/if}
	{#if showing_dropdown}
		<div
			class="popup"
			in:fade={{ duration: 100 }}
			use:popperContent={{
				modifiers: [{ name: 'offset', options: { offset: [0, 3] } }]
			}}
		>
			{#if !active_submenu}
				<div class="options">
					{#each options as option, i}
						{@const has_submenu_items = option.suboptions?.length > 0}
						<div class="item" class:disabled={option.disabled}>
							<button
								class:active={label === option.label}
								class:danger={option.is_danger}
								onclick={(e) => {
									if (option.on_click) {
										showing_dropdown = false
										option.on_click(e)
									} else {
										showing_dropdown = false
										dispatch('input', option.value)
									}
								}}
								type="button"
							>
								<Icon icon={option.icon} />
								<span>{option.label}</span>
							</button>
							{#if has_submenu_items}
								<button
									onclick={() => {
										active_submenu = { title: option.label, options: option.suboptions }
									}}
								>
									<Icon icon="material-symbols:chevron-right" />
								</button>
							{/if}
						</div>

						{#if dividers.includes(i)}
							<hr />
						{/if}
					{/each}
				</div>
			{:else if active_submenu}
				<div class="submenu" in:fade={{ duration: 100 }}>
					<header>
						<span>{active_submenu.title}</span>
						<button
							onclick={() => {
								active_submenu = null
								selected_submenu_option = null
							}}
							type="button"
						>
							<Icon icon="carbon:close" />
						</button>
					</header>
					<div class="options">
						<!-- async submenu fetch not being used atm, but keeping as a reference for fetching child pages in PageList later (instead of fetching all pages at once)-->
						{#if typeof options === 'function'}
							{#await options()}
								<Icon width="25" icon="line-md:loading-twotone-loop" />
							{:then items}
								{#each items as { label, value, onclick }}
									<button
										onclick={() => {
											if (onclick) {
												onclick()
											} else {
												dispatch('input', value)
											}
										}}
										type="button"
									>
										{label}
									</button>
								{/each}
							{/await}
						{:else}
							{#each active_submenu.options as { label, value, onclick }}
								<div class="item">
									<button
										onclick={() => {
											showing_dropdown = false
											active_submenu = null
											if (onclick) {
												onclick()
											} else {
												dispatch('input', value)
											}
										}}
										type="button"
									>
										{label}
									</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style lang="postcss">
	.Dropdown {
		width: 100%;
		position: relative;
		opacity: var(--Dropdown-opacity, 1);
		display: flex;
	}
	.Dropdown.large-button {
		button.primary,
		button.vertical-menu {
			font-size: 19px;
			padding: 6px;
			/* outline: 1px solid var(--color-gray-8); */
		}
	}
	button.primary {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		border: 1px solid var(--color-gray-8);
		padding: 6px 0.5rem;
		padding-right: 4px; /* offset dropdown icon */
		width: 100%;
		border-radius: var(--primo-border-radius);
		font-size: 0.875rem;
		display: grid;
		grid-template-columns: auto 1fr auto;

		p {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.dropdown-icon {
			margin-left: auto;
		}
	}
	hr {
		border-color: var(--color-gray-8);
	}
	.popup {
		display: grid;
		gap: 0.375rem;
		place-items: normal;
		padding: 0.25rem;
		font-size: 0.75rem;
		border-radius: 0.25rem;
		/* position: absolute;
		left: 0;
		top: 38px; */
		background: #171717;
		border: 1px solid #292929;
		z-index: 999;

		.options {
			display: grid;
			/* gap: 4px; */
			place-content: center;

			hr {
				margin-block: 0.25rem;
			}
		}

		.item {
			display: flex;
			align-items: stretch;
		}
		.item.disabled {
			pointer-events: none;
			opacity: 0.5;
		}
	}
	.submenu {
		header {
			font-weight: 600;
			padding: 0.25rem 0.5rem;
			padding-right: 0;

			white-space: nowrap;
			display: flex;
			justify-content: space-between;
			align-items: center;
			border-bottom: 1px solid var(--color-gray-8);
			margin-bottom: 0.25rem;

			span {
				font-weight: 500;
			}
		}
	}

	.item button {
		display: flex;
		align-items: center;
		/* justify-content: space-between; */
		gap: 0.375rem;
		border-radius: 0.25rem;
		padding: 0.25rem;
		/* width: 100%; */
		text-align: left;
		white-space: nowrap;
		transition: 0.1s;

		&:first-child {
			flex: 1;
		}

		&:hover:not(.active),
		&:focus-visible:not(.active) {
			background: var(--color-gray-8);
			outline: 0;
		}

		&.active {
			cursor: initial;
			opacity: 0.5;
		}

		&.danger {
			color: var(--primo-color-danger);

			&:hover {
				color: white;
				background: var(--primo-color-danger);
			}
		}
	}
</style>
