<script>
	import Icon from '@iconify/svelte'
	import { v4 as uuid } from 'uuid'
	import * as factories from '$lib/builder/factories'
	import Site_Symbol from './Site_Symbol.svelte'
	import { page } from '$app/stores'

	/**
	 * @typedef {Object} Props
	 * @property {any} site - export let blocks
	 * @property {any} [selected]
	 * @property {string} [append]
	 */

	/** @type {Props} */
	let { site, selected = $bindable([]), append = '' } = $props()

	let blocks = []

	async function fetch_symbols(page_id) {
		console.log({ page_id })
		const { data, error } = await $page.data.supabase.from('sections').select('*, symbol(*, site(entries, code)), page(id)').match({ 'page.id': page_id })
		console.log({ data, error })
		const symbols = data.filter((item) => item.page).map((item) => item.symbol)
		console.log({ symbols })
		return symbols
	}

	let symbol_groups = $state([])
	$page.data.supabase
		.from('pages')
		.select('*')
		.eq('site', '1e799b01-77f2-469c-afeb-ab405eee9a4d')
		.then(({ data }) => {
			// console.log({ data })
			symbol_groups = data.filter((item) => item.name !== 'Home Page')
		})

	function include_symbol(symbol) {
		if (selected.some((s) => s.id === symbol.id) || checked.includes(symbol.id)) {
			selected = selected.filter((item) => item.id !== symbol.id)
			checked = checked.filter((item) => item !== symbol.id)
		} else {
			selected = [
				...selected,
				factories.Symbol({
					...symbol,
					owner_site: site.id,
					id: uuid()
				})
			]
			checked = [...checked, symbol.id]
		}
	}

	let selected_group = $state(null)

	let checked = $state([])
	// const symbol_groups = ['Hero', 'Routing', 'Call to Action', 'Form', 'Logo Cloud', 'Editorial Content', 'Accordion', 'Statistic', 'Header', 'Footer', 'Gallery']
	// $: selected_symbols = blocks.filter((block) => blocks.find((block) => block.name.includes(selected_group)))
	let selected_symbols = $derived(blocks.filter((block) => block.name.includes(selected_group)))
</script>

<div class="BlockPicker">
	{#if !selected_group}
		<div class="symbol-groups">
			{#each symbol_groups as group}
				<button class="group-item" onclick={() => (selected_group = group.id)}>
					{group.name}
				</button>
			{/each}
		</div>
	{:else}
		<button class="back-button" onclick={() => (selected_group = null)}>
			<Icon icon="ep:back" />
			<span>Back to Groups</span>
		</button>
		<ul class="symbol-list">
			{#await fetch_symbols(selected_group) then symbols}
				{#each symbols as symbol}
					<li>
						<Site_Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} {site} {append} controls_enabled={false} />
					</li>
				{/each}
			{/await}
		</ul>
	{/if}
</div>

<style lang="postcss">
	.BlockPicker {
		background: #222;
		padding: 1rem;
	}
	.symbol-groups {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1rem;
	}
	ul.symbol-list {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1rem;
	}
	.group-item {
		padding: 2rem;
		text-align: center;
		background: var(--color-gray-8);
	}
	button.back-button {
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 2px;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--color-gray-1);
		padding-bottom: 3px;
	}
</style>
