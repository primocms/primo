<script>
	import TextInput from '../ui/TextInput.svelte'
	import { createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import axios from 'axios'
	import { createPopperActions } from 'svelte-popperjs'
	import { clickOutside } from '../utilities'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} icon
	 * @property {string} [search_query]
	 * @property {string} [variant]
	 * @property {any} [svg_preview]
	 */

	/** @type {Props} */
	let { icon, search_query = $bindable(''), variant = 'large', svg_preview = null } = $props()

	const [popperRef, popperContent] = createPopperActions({
		placement: 'bottom-start',
		strategy: 'fixed'
	})

	let searched = $state(false)

	// search immediately when passed a query
	if (search_query) {
		search()
	}

	// hide icons when clearing search text
	$effect(() => {
		if (search_query === '') {
			searched = false
		}
	})

	let icons = $state([])
	async function search() {
		axios.get(`https://api.iconify.design/search?query=${encodeURIComponent(search_query.trim())}&limit=32`).then(({ data }) => {
			icons = data.icons
			searched = true
		})
	}

	let showing_popover = $state(false)
</script>

<div class="IconPicker {variant}">
	<div class="container">
		{#if variant === 'large'}
			{#if svg_preview || icon}
				<div class="icon-preview">
					<button onclick={() => dispatch('input', null)}>
						<Icon icon="material-symbols:delete" />
					</button>
					{#if svg_preview}
						{@html svg_preview}
					{:else}
						<Icon {icon} />
					{/if}
				</div>
			{/if}
			<form
				onsubmit={(e) => {
					e.preventDefault()
					search()
				}}
			>
				<TextInput bind:value={search_query} prefix_icon="tabler:search" button={{ label: 'Search', type: 'submit', disabled: !search_query }} />
			</form>
		{:else if variant === 'small'}
			<button class="icon-preview" aria-label="select icon" use:popperRef onclick={() => (showing_popover = !showing_popover)}>
				<Icon {icon} />
			</button>
		{/if}
	</div>
	{#if showing_popover}
		<div
			class="popup"
			in:fade={{ duration: 100 }}
			use:clickOutside
			onclick_outside={() => (showing_popover = false)}
			use:popperContent={{
				modifiers: [{ name: 'offset', options: { offset: [0, 3] } }]
			}}
		>
			<form
				onsubmit={(e) => {
					e.preventDefault()
					search()
				}}
			>
				<TextInput autofocus={true} bind:value={search_query} prefix_icon="tabler:search" label="Search icons" button={{ label: 'Search', type: 'submit', disabled: !search_query }} />
			</form>
			{#if searched}
				<div class="icons" in:fade>
					<button
						class="close"
						aria-label="Close"
						onclick={() => {
							searched = false
							search_query = ''
						}}
					>
						<Icon icon="material-symbols:close" />
					</button>
					{#each icons as item}
						<button
							class="icon"
							class:active={item === icon}
							onclick={() => {
								dispatch('input', item)
								showing_popover = false
							}}
							type="button"
						>
							<Icon icon={item} width="50px" />
						</button>
					{:else}
						<span
							style="grid-column: 1 / -1;
					padding: 0.5rem;
					font-size: 0.875rem;
					border-left: 3px solid red;"
						>
							No icons found
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	{#if searched && variant === 'large'}
		<div class="icons" in:fade>
			<button
				class="close"
				aria-label="Close"
				onclick={() => {
					searched = false
					search_query = ''
				}}
			>
				<Icon icon="material-symbols:close" />
			</button>
			{#each icons as item}
				<button class="icon" class:active={item === icon} onclick={() => dispatch('input', item)} type="button">
					<Icon icon={item} width="50px" />
				</button>
			{:else}
				<span
					style="grid-column: 1 / -1;
				padding: 0.5rem;
				font-size: 0.875rem;
				border-left: 3px solid red;"
				>
					No icons found
				</span>
			{/each}
		</div>
	{/if}
</div>

<style lang="postcss">
	.IconPicker.small {
		.icon-preview {
			font-size: 25px;
		}
	}
	.container {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
	}

	.icon-preview {
		font-size: 1.75rem;
		border: 1px solid var(--color-gray-8);
		padding: 0.25rem;
		border-radius: var(--primo-border-radius);
		position: relative;
		overflow: hidden;

		button {
			position: absolute;
			inset: 0;
			opacity: 0;
			transition: 0.1s;
			display: flex;
			justify-content: center;
			align-items: center;
			background: var(--primo-color-danger);
			font-size: 1.25rem;
		}

		button:hover {
			opacity: 1;
		}
	}

	form {
		flex: 1;
	}

	.popup {
		background: var(--color-gray-9);
		padding: 0.5rem;
		z-index: 1;
	}

	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
		border: 1px solid var(--color-gray-8);
		margin-top: 0.25rem;
		border-radius: var(--primo-border-radius);
		position: relative;
		margin-top: 0.25rem;
		padding: 0.75rem;

		button.close {
			position: absolute;
			top: 0;
			right: 0;
			padding: 0.5rem;

			&:hover {
				color: var(--color-gray-4);
			}
		}
	}

	button {
		transition: 0.1s;

		&.active {
			color: var(--weave-primary-color);
		}
	}
</style>
