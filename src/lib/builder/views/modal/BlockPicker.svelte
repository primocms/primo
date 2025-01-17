<script>
	import ModalHeader from '../../views/modal/ModalHeader.svelte'
	import Icon from '@iconify/svelte'
	import Symbol from '../../components/Site_Symbol.svelte'
	import { v4 as uuid } from 'uuid'
	import { dataChanged } from '$lib/builder/database'
	import { Symbol as Create_Symbol } from '../../factories'
	import primo_symbols from '../../stores/data/primo_symbols'
	import { site as site_store } from '$lib/builder/stores/data'
	import { supabase } from '$lib/builder/supabase'
	import { get_site_data } from '$lib/builder/stores/helpers.js'
	import { page } from '$app/stores'
	import { browser } from '$app/environment'
	import axios from 'axios'

	let { site, onsave } = $props()

	let symbols = $state([])
	let selected = $state([])

	fetch_symbols()
	async function fetch_symbols(page_id) {
		const { data, error } = await supabase.from('library_symbols').select('*, entries(*), fields(*)').eq('owner', $page.data.user.id)
		symbols = data
	}

	function include_symbol(symbol) {
		if (selected.some((s) => s.id === symbol.id) || checked.includes(symbol.id)) {
			selected = selected.filter((item) => item.id !== symbol.id)
			checked = checked.filter((item) => item !== symbol.id)
		} else {
			selected = [
				...selected,
				Create_Symbol({
					...symbol,
					site: site.id,
					id: uuid()
				})
			]
			checked = [...checked, symbol.id]
		}
	}

	let selected_group = $state(null)

	let checked = $state([])

	let site_html = $state(null)
	async function build_site_html(html) {
		if (html.length === 0) return ''
		const site_data = await get_site_data({})
		const { data } = await axios.post(`/api/render`, {
			// id: symbol.id,
			code: {
				html: `<svelte:head>${html}</svelte:head>`,
				css: '',
				js: ''
			},
			data: site_data,
			dev_mode: false
		})

		site_html = data.head
	}
	$effect(() => {
		if (browser) build_site_html(site.code.head)
	})
</script>

<ModalHeader
	icon="lucide:blocks"
	title="Add Library Blocks to Site"
	button={{
		label: `Add ${selected.length} Blocks`,
		onclick: () => onsave(selected),
		icon: 'lucide:blocks',
		disabled: selected.length === 0
	}}
/>

<div class="BlockPicker">
	<ul>
		{#each symbols.slice(0, 10) as symbol}
			<li>
				<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
			</li>
		{/each}
	</ul>
	<ul>
		{#each symbols.slice(10, 20) as symbol}
			<li>
				<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
			</li>
		{/each}
	</ul>
	<ul>
		{#each symbols.slice(20, 30) as symbol}
			<li>
				<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
			</li>
		{/each}
	</ul>
	<!-- <ul class="symbol-list">
		{#each symbols as symbol}
			<li>
				<Symbol checked={checked.includes(symbol.id)} on:click={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
			</li>
		{/each}
	</ul> -->
	<!-- {#if false}
		<div class="symbol-groups">
			{#each symbols as symbol}
				<button class="group-item" onclick={() => (selected_group = symbol)}>
					{symbol.name}
				</button>
			{/each}
		</div>
	{:else}
		<button class="back-button" onclick={() => (selected_group = null)}>
			<Icon icon="ep:back" />
			<span>Back to Groups</span>
		</button>
		<ul class="symbol-list">
			{#each symbols as symbol}
				<li>
					<Symbol checked={checked.includes(symbol.id)} on:click={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
				</li>
			{/each}
		</ul>
	{/if} -->
</div>

<style lang="postcss">
	.BlockPicker {
		background: #111;
		padding: 1rem;
		height: calc(100vh - 70px);
		overflow: auto;
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.5rem;
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
