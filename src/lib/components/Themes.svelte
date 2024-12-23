<script>
	import Icon from '@iconify/svelte'
	import { createEventDispatcher } from 'svelte'
	import _ from 'lodash-es'
	import axios from 'axios'
	import ThemeThumbnail from '$lib/components/ThemeThumbnail.svelte'
	import { supabase } from '$lib/supabase'

	/**
	 * @typedef {Object} Props
	 * @property {string} [append]
	 */

	/** @type {Props} */
	let { append = '' } = $props();

	let themes = $state([])
	fetch_themes()
	async function fetch_themes() {
		themes = await Promise.all(
			[
				['minimal', 'Minimal'],
				['agency', 'Agency'],
				['nonprofit', 'Nonprofit'],
				['blog', 'Blog']
			].map(async ([id, name]) => {
				const preview = await download_file(id, 'preview.html')
				return { id, name, preview }
			})
		)
	}

	async function download_file(site_id, file) {
		const reader = new FileReader()
		return new Promise(async (resolve, reject) => {
			const { data, error } = await supabase.storage.from('starters').download(`${site_id}/${file}?interview`)
			reader.onload = function () {
				if (file.includes('json')) {
					resolve(JSON.parse(reader.result))
				} else {
					resolve(reader.result)
				}
			}
			reader.readAsText(data)
		})
	}

	const dispatch = createEventDispatcher()

	let selected = $state(null)
	async function select_theme(id, preview) {
		selected = id
		const data = await download_file(id, 'site.json')
		dispatch('select', { data, preview })
	}

	let active_theme_page = $state(0)
	let active_themes = $derived(themes.length > 0 ? themes.slice(active_theme_page * 4, active_theme_page * 4 + 4) : [])
</script>

<header>
	<h2 class="heading">Starters</h2>
	{#if themes.length > 0}
		<div class="buttons">
			<button onclick={() => active_theme_page--} type="button" disabled={active_theme_page === 0}>
				<Icon icon="ic:round-chevron-left" />
			</button>
			<button onclick={() => active_theme_page++} disabled={active_theme_page >= themes.length / 4 - 1} type="button">
				<Icon icon="ic:round-chevron-right" />
			</button>
		</div>
	{/if}
</header>
<div class="themes">
	{#each active_themes as { id, name, preview }}
		<ThemeThumbnail selected={selected === id} on:click={() => select_theme(id, preview)} title={name} {preview} {append} />
	{/each}
</div>

<style lang="postcss">
	header {
		display: flex;
		justify-content: space-between;

		h2 {
			font-size: 0.875rem;
			margin-bottom: 0.75rem;
		}
	}
	button {
		font-size: 1.25rem;
		&:not(:disabled):hover {
			color: var(--primo-color-brand);
		}
		&:disabled {
			opacity: 0.25;
			cursor: initial;
		}
	}
	.themes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		place-items: start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
</style>
