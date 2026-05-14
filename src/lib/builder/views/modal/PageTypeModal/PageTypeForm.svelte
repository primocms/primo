<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import { watch } from 'runed'
	import UI from '../../../ui/index.js'
	import Icon from '@iconify/svelte'
	import IconPicker from '../../../components/IconPicker.svelte'
	import { clickOutside } from '../../../utilities.js'
	import { createPopperActions } from 'svelte-popperjs'
	import { offsetByFixedParents } from '$lib/builder/utils/popper-fix'
	import { site_context } from '../../../stores/context.js'

	const dispatch = createEventDispatcher()
	const { value: site } = site_context.get()

	const color_options = [
		'#2B407D', // Navy blue (default)
		'#5B8FA3', // Blue
		'#87CEEB', // Sky blue
		'#4A90E2', // Bright blue
		'#6B9BD2', // Light blue
		'#2ECC71', // Green
		'#27AE60', // Dark green
		'#52C9DC', // Cyan
		'#9B59B6', // Purple
		'#8E44AD', // Dark purple
		'#E74C3C', // Red
		'#C0392B', // Dark red
		'#E67E22', // Orange
		'#F39C12', // Gold
		'#F1C40F', // Yellow
		'#1ABC9C', // Turquoise
		'#16A085', // Dark turquoise
		'#95A5A6', // Gray
		'#34495E', // Dark gray
		'#E91E63' // Pink
	]

	/**
	 * @typedef {Object} Props
	 * @property {string} [new_page_name]
	 * @property {string} [new_color]
	 * @property {string} [new_icon]
	 */

	/** @type {Props} */
	let { new_page_name: initial_name = '', new_color: initial_color = '#2B407D', new_icon: initial_icon = 'iconoir:page' } = $props()

	// Local state initialized from props, won't be overwritten by parent updates
	let new_page_name = $state(initial_name)
	let new_color = $state(initial_color)
	let new_icon = $state(initial_icon)

	let page_creation_disabled = $derived(!new_page_name)

	const new_page_details = $derived({
		name: new_page_name,
		color: new_color,
		icon: new_icon,
		head: '',
		foot: ''
	})

	const [popperRef, popperContent] = createPopperActions({
		placement: 'bottom',
		strategy: 'fixed',
		modifiers: [offsetByFixedParents, { name: 'offset', options: { offset: [0, 3] } }]
	})

	let showing_icon_picker = $state(false)
	let showing_color_picker = $state(false)

	const [colorPopperRef, colorPopperContent] = createPopperActions({
		placement: 'bottom',
		strategy: 'fixed',
		modifiers: [offsetByFixedParents, { name: 'offset', options: { offset: [0, 3] } }]
	})

	// Find which page type is using each color
	function get_page_type_using_color(color: string) {
		const existing_page_types = site?.page_types() || []
		return existing_page_types.find((pt) => pt.color === color)
	}

	// Auto-select the first unused color once when creating a new page type
	if (initial_name === '' && site) {
		const existing_page_types = site?.page_types() || []
		const used_colors = new Set(existing_page_types.map((pt) => pt.color))
		const unused_color = color_options.find((color) => !used_colors.has(color))

		// Set the first unused color as default
		if (unused_color) {
			new_color = unused_color
		}
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault()
		dispatch('create', new_page_details)
	}}
	in:fade={{ duration: 100 }}
>
	<div style="width: 100%">
		<div class="top">
			<UI.TextInput autofocus={true} bind:value={new_page_name} id="page-label" label="Page Type Name" placeholder="Post" />
			<button
				use:popperRef
				onclick={() => (showing_icon_picker = true)}
				style="display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				margin-top: 22px;"
				type="button"
				aria-label="Select page type icon"
			>
				<span
					class="icon"
					style="    width: 2rem;
				aspect-ratio: 1;
				border-radius: 50%;
				background: var(--color-gray-8);
				display: flex;
				align-items: center;
				justify-content: center;"
				>
					<Icon icon={new_icon} />
				</span>
			</button>
			<button
				use:colorPopperRef
				onclick={() => (showing_color_picker = true)}
				style="display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				margin-top: 22px;"
				type="button"
				aria-label="Select page type color"
			>
				<span
					class="preview"
					style="width: 2rem;
					aspect-ratio: 1;
					border-radius: 50%;
					display: block;
					background-color: {new_color};"
				></span>
			</button>
			<button class="save" disabled={page_creation_disabled} type="submit">
				<Icon icon="akar-icons:check" />
			</button>
		</div>
		{#if showing_icon_picker}
			<div
				use:popperContent
				use:clickOutside
				onclick_outside={() => (showing_icon_picker = false)}
				class="icon-picker"
				style="position: absolute;
    background: var(--color-gray-9);
    padding: 1rem;z-index: 9;    bottom: 12rem;
    left: 6rem;"
			>
				<IconPicker
					search_query={new_page_name}
					icon={new_icon}
					on:input={(e) => {
						new_icon = e.detail
					}}
				/>
			</div>
		{/if}
		{#if showing_color_picker}
			<div use:colorPopperContent use:clickOutside onclick_outside={() => (showing_color_picker = false)} class="color-picker">
				<div class="color-grid">
					{#each color_options as color}
						{@const page_type = get_page_type_using_color(color)}
						<button
							type="button"
							onclick={() => {
								new_color = color
								showing_color_picker = false
							}}
							class="color-option"
							style:background-color={color}
							aria-label="Select color"
							title={page_type ? `Used by ${page_type.name}` : ''}
						>
							{#if new_color === color}
								<Icon icon="akar-icons:check" style="color: white; font-size: 0.875rem;" />
							{:else if page_type}
								<Icon icon={page_type.icon} style="color: white; font-size: 0.875rem;" />
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</form>

<style lang="postcss">
	.top {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}
	form {
		padding: 0.25rem;
		display: flex;
		gap: 0.5rem;
		padding: 0.825rem 1.125rem;
		align-items: center;
		background: #1a1a1a;
		--TextInput-label-font-size: 0.75rem;

		button.save {
			border: 1px solid var(--primo-primary-color);
			border-radius: 0.25rem;
			padding: 9px 0.75rem;
			margin-top: 23px;

			&:disabled {
				opacity: 20%;
			}
		}
	}

	.color-picker {
		position: absolute;
		background: var(--color-gray-9);
		padding: 1rem;
		z-index: 9;
		border: 1px solid var(--color-gray-7);
		border-radius: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.5rem;
	}

	.color-option {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease;

		&:hover {
			transform: scale(1.1);
			border-color: rgba(255, 255, 255, 0.5);
		}

		&:active {
			transform: scale(0.95);
		}
	}
</style>
