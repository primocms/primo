<script>
	import { createEventDispatcher } from 'svelte'
	import _ from 'lodash-es'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import { clickOutside, createUniqueID } from '../utilities.js'
	import { createPopperActions } from 'svelte-popperjs'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {string} [icon]
	 * @property {string} [label]
	 * @property {any} [options]
	 * @property {any} [value]
	 * @property {any} [fallback_label]
	 * @property {any} [dividers]
	 * @property {string} [placement]
	 * @property {string} [variant]
	 * @property {boolean} [fullwidth]
	 * @property {boolean} [loading]
	 */

	/** @type {Props} */
	let {
		icon = '',
		label = '',
		options = [],
		value = options[0]?.['value'],
		fallback_label = null,
		dividers = [],
		placement = 'bottom-start',
		variant = 'small',
		fullwidth = false,
		loading = false
	} = $props()

	const [popperRef, popperContent] = createPopperActions({
		placement,
		strategy: 'fixed',
		modifiers: fullwidth
			? [
					{ name: 'offset', options: { offset: [0, 3] } },
					{
						name: 'sameWidth',
						enabled: true,
						fn: ({ state }) => {
							state.styles.popper.width = `${state.rects.reference.width}px`
						},
						phase: 'beforeWrite',
						requires: ['computeStyles']
					}
				]
			: [{ name: 'offset', options: { offset: [0, 3] } }]
	})

	let showing_dropdown = $state(false)

	let active_submenu = $state(null)
	let selected_submenu_option = null

	const select_id = createUniqueID()

	function find_with_object(options, value) {
		let selected
		for (const option of options) {
			const selected_suboption = option.suboptions?.find((sub) => sub.value === value)
			if (selected_suboption) {
				selected = selected_suboption
			} else if (option.value === value) {
				selected = option
			}
		}
		return selected
	}

	options.find((option) => {
		const selected_suboption = option.suboptions?.find((sub) => sub.value === value)
		return option.value === value || selected_suboption
	})

	// highlight button when passed value changes (i.e. when auto-changing field type based on name)
	let highlighted = $state(false)
	let disable_highlight = true // prevent highlighting on initial value set
	let manually_selected = $state(false) // or manual set
	let last_value = $state(value)
	function highlight_button(val) {
		if (disable_highlight) {
			disable_highlight = false
			return
		} else if (!manually_selected && val !== last_value) {
			highlighted = true
			last_value = val
			setTimeout(() => {
				highlighted = false
			}, 400)
		}
	}
	let selected = $derived(find_with_object(options, value))
	$effect(() => {
		highlight_button(value)
	})
</script>

<div class="Select {variant}" use:clickOutside onclick_outside={() => (showing_dropdown = false)} role="menu">
	<div class="select-container">
		{#if label}
			<label class="primo--field-label" for={select_id}>
				{#if icon}
					<Icon {icon} />
				{/if}
				<span>
					{label}
				</span>
			</label>
		{/if}
		<button id={select_id} class="primary" class:highlighted type="button" use:popperRef onclick={() => (showing_dropdown = !showing_dropdown)}>
			{#if loading}
				<div style="padding: 3.5px;">
					<Icon icon="line-md:loading-twotone-loop" />
				</div>
			{:else if selected}
				{#if selected.icon}
					<div class="icon">
						<Icon icon={selected.icon} />
					</div>
				{/if}
				<p>{selected.label}</p>
			{:else if fallback_label}
				<p>{fallback_label}</p>
			{/if}
			<span class="dropdown-icon">
				<Icon icon="mi:select" />
			</span>
		</button>
	</div>
	{#if showing_dropdown}
		<div class="popup" in:fade={{ duration: 100 }} use:popperContent>
			{#if !active_submenu}
				<div class="options">
					{#each options as option, i}
						{@const has_submenu_items = option.suboptions?.length > 0}
						<div class="item">
							<button
								class:active={label === option.label}
								disabled={option.disabled}
								onclick={(e) => {
									manually_selected = true
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
						<button onclick={() => (active_submenu = null)} type="button">
							<Icon icon="carbon:close" />
						</button>
					</header>
					<div class="options">
						<!-- async submenu fetch not being used atm, but keeping as a reference for fetching child pages in PageList later (instead of fetching all pages at once)-->
						{#if typeof options === 'function'}
							<!-- {#await options()}
								<Icon width="25" icon="line-md:loading-twotone-loop" />
							{:then items}
								{#each items as { label, value, onclick }}
									<button
										on:click={() => {
											manually_selected = true
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
							{/await} -->
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
	.Select {
		/* width: 100%; */
		flex: 1;
		position: relative;
		opacity: var(--Select-opacity, 1);

		&.large {
			.icon,
			.popup,
			p {
				font-size: 1rem !important;
			}
		}
	}
	.select-container {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.icon {
		font-size: 0.75rem;
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
		transition: 0.1s;

		&.highlighted {
			color: var(--weave-primary-color);
		}

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
		max-height: 20rem;
		overflow: auto;
		background: #171717;
		border: 1px solid #292929;
		z-index: 1;

		.options {
			hr {
				margin-block: 0.25rem;
			}
		}

		.item {
			display: flex;
			align-items: stretch;
		}

		.item button {
			padding: 0.25rem 0.5rem;
		}

		.item button:disabled {
			opacity: 0.2;
			cursor: not-allowed;

			&:hover {
				background: initial;
			}
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

	button {
		display: flex;
		align-items: center;
		/* justify-content: space-between; */
		gap: 0.375rem;
		border-radius: 0.25rem;
		padding: 0.25rem;
		/* width: 100%; */
		text-align: left;
		white-space: nowrap;

		&:first-child {
			flex: 1;
		}

		&:hover:not(.active) {
			background: #292929;
		}

		&.active {
			cursor: initial;
			opacity: 0.5;
		}
	}
</style>
