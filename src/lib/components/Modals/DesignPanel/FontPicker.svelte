<script>
	import Icon from '@iconify/svelte'
	import _ from 'lodash-es'
	import UI from '$lib/builder/ui'
	import { createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import axios from 'axios'
	import Fuse from 'fuse.js'

	const dispatch = createEventDispatcher()

	let { label, value = $bindable() } = $props()

	let search_query = $state('')
	let searched = $state(false)

	// hide icons when clearing search text
	$effect(() => {
		if (search_query === '') {
			searched = false
		}
	})

	let all_fonts = []
	let results = $state([])

	axios.get(`https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyCjyO1GLN6D9LFBCVFNSVoyAC55givY0pg`).then(({ data }) => {
		all_fonts = data.items
	})

	async function search() {
		if (search_query.length === 0) {
			if (selected_category === 'all') {
				results = _.sampleSize(all_fonts, 10)
			} else {
				filter_fonts()
			}
		} else {
			const options = {
				// Fuse.js options for fuzzy searching
				keys: ['family', 'category'],
				includeScore: true
			}
			const fuse = new Fuse(all_fonts, options)

			results = fuse
				.search(search_query)
				.slice(0, 10)
				.map(({ item }) => item)
		}
		searched = true
	}

	function select_font(font) {
		value = font.family
		dispatch('input')
	}

	let selected_category = $state('all')
	function filter_fonts() {
		if (selected_category === 'all') {
			results = all_fonts.slice(0, 10)
		} else {
			results = _.sampleSize(
				all_fonts.filter((font) => font.category === selected_category),
				10
			)
		}
		searched = true
	}
</script>

<svelte:head>
	{#each results as font}
		<link href="https://fonts.googleapis.com/css2?family={font.family.replace(/ /g, '+')}:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700" rel="stylesheet" />
	{/each}
	<link href="https://fonts.googleapis.com/css2?family={value.replace(/ /g, '+')}:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700" rel="stylesheet" />
</svelte:head>

<div class="FontPicker">
	<p class="label">{label}</p>
	<div class="container">
		{#if value}
			<div class="font-preview" style:font-family={value}>
				{value}
			</div>
		{/if}
		<form
			onsubmit={(e) => {
				e.preventDefault()
				search()
			}}
		>
			<UI.TextInput
				options={[
					{
						label: 'All',
						value: 'all'
					},
					{
						label: 'Serif',
						value: 'serif'
					},
					{
						label: 'Sans Serif',
						value: 'sans-serif'
					},
					{
						label: 'Display',
						value: 'display'
					},
					{
						label: 'Handwriting',
						value: 'handwriting'
					},
					{
						label: 'Monospace',
						value: 'monospace'
					}
				]}
				on:select={() => {
					if (results.length > 0) filter_fonts()
				}}
				bind:selection={selected_category}
				bind:value={search_query}
				prefix_icon="tabler:search"
				label="Search fonts"
				button={{ label: search_query ? 'Search' : 'Show Random', type: 'submit' }}
			/>
		</form>
	</div>
	{#if searched}
		<div class="fonts" in:fade>
			<button class="close" aria-label="Close" onclick={() => (searched = false)}>
				<Icon icon="material-symbols:close" />
			</button>
			{#each results as font}
				{#key font.family}
					<button in:fade={{ delay: 100 }} style:font-family={font.family} class:active={value === font.family} onclick={() => select_font(font)}>
						{font.family}
					</button>
				{/key}
			{:else}
				<span
					style="grid-column: 1 / -1;
				padding: 0.5rem;
				font-size: 0.875rem;
				border-left: 3px solid red;"
				>
					No fonts found
				</span>
			{/each}
		</div>
	{/if}
</div>

<style lang="postcss">
	.FontPicker {
		display: grid;
	}
	.label {
		/* margin-bottom: 0.5rem; */
		font-size: var(--label-font-size, 1rem);
		font-weight: var(--label-font-weight, 700);
		margin-bottom: 0.25rem;
	}

	.container {
		display: grid;
		gap: 1rem;
	}

	.font-preview {
		font-size: 2.5rem;
		line-height: 1;
	}

	form {
		flex: 1;
	}

	.fonts {
		font-size: 1.5rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		border: 1px solid var(--color-gray-7);
		margin-top: 0.25rem;
		border-radius: var(--primo-border-radius);
		position: relative;

		button {
			padding: 1rem;
		}

		button.close {
			position: absolute;
			top: 0;
			right: 0;
			padding: 0.5rem;

			&:hover {
				color: var(--primo-color-brand);
			}
		}
	}

	button {
		transition: 0.1s;

		&.active {
			color: var(--primo-color-brand);
		}
	}
</style>
