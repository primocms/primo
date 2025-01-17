<script>
	import { LayoutTemplate, ArrowUpRight } from 'lucide-svelte'
	import { createEventDispatcher } from 'svelte'
	import _ from 'lodash-es'
	import axios from 'axios'
	// import ThemeThumbnail from '$lib/components/ThemeThumbnail.svelte'
	import StarterButton from '$lib/components/StarterButton.svelte'
	import { supabase } from '$lib/supabase'
	import { page } from '$app/stores'
	import EmptyState from '$lib/components/EmptyState.svelte'

	/**
	 * @typedef {Object} Props
	 * @property {string} [append]
	 */

	/** @type {Props} */
	let { append = '' } = $props()

	let themes = $state([])
	fetch_themes()
	async function fetch_themes() {
		themes = await Promise.all(
			$page.data.starters.map(async ({ id, name }) => {
				const preview = await download_file(id, 'preview.html')
				return { id, name, preview }
			})
		)
	}

	async function download_file(site_id, file) {
		const reader = new FileReader()
		return new Promise(async (resolve, reject) => {
			const { data, error } = await supabase.storage.from('sites').download(`${site_id}/${file}`)
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
		dispatch('select', { id, preview })
	}
</script>

<div class="themes">
	{#each themes as { id, name, preview }}
		<StarterButton site={{ id, name }} selected={selected === id} onclick={() => select_theme(id, preview)} {preview} {append} />
	{/each}
</div>

<style lang="postcss">
	.themes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		place-items: start;
		gap: 1rem;
	}
</style>
