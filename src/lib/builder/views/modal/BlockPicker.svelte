<script>
	import ModalHeader from '../../views/modal/ModalHeader.svelte'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import Symbol from '../../components/Site_Symbol.svelte'
	import { Symbol as Create_Symbol } from '../../factories'
	import { site_design_css } from '$lib/builder/code_generators.js'
	import { design as siteDesign } from '$lib/builder/stores/data/site.js'
	import { site as site_store } from '$lib/builder/stores/data'
	import { supabase } from '$lib/builder/supabase'
	import { get_site_data } from '$lib/builder/stores/helpers.js'
	import { page } from '$app/stores'
	import { browser } from '$app/environment'
	import axios from 'axios'

	let { site, onsave } = $props()

	let symbol_groups = $state([])
	let selected_group_id = $state(null)
	let selected_symbol_group = $derived(symbol_groups.find((g) => g.id === selected_group_id) || null)
	let columns = $derived(
		selected_symbol_group
			? [
					selected_symbol_group.symbols.slice((selected_symbol_group.symbols.length / 3) * 2, (selected_symbol_group.symbols.length / 3) * 3),
					selected_symbol_group.symbols.slice(selected_symbol_group.symbols.length / 3, (selected_symbol_group.symbols.length / 3) * 2),
					selected_symbol_group.symbols.slice(0, selected_symbol_group.symbols.length / 3)
				]
			: []
	)

	let selected = $state([])

	fetch_symbols()
	async function fetch_symbols() {
		const { data, error } = await supabase
			.from('library_symbol_groups')
			.select(`*, symbols:library_symbols(*, entries(*), fields(*))`)
			.eq('owner', $page.data.user.id)
			.order('created_at', { ascending: false })
		symbol_groups = data
		selected_group_id = symbol_groups[0]?.id
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
					name: selected_symbol_group.name,
					owner_site: site.id,
					library_group: null,
					fields: symbol.fields.map((f) => ({ ...f, library_symbol: null })),
					entries: symbol.entries.map((f) => ({ ...f, library_symbol: null }))
				})
			]
			checked = [...checked, symbol.id]
		}
	}

	let checked = $state([])

	let site_html = $state(null)
	async function build_site_html(html) {
		if (html.length === 0) return ''
		const site_data = await get_site_data({})
		const { data } = await axios.post(`/api/render`, {
			// id: symbol.id,
			code: {
				html: `<svelte:head>${html + site_design_css($siteDesign)}</svelte:head>`,
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

<Sidebar.Provider>
	<Sidebar.Root collapsible="none">
		<Sidebar.Content class="p-2">
			<Sidebar.Menu>
				{#each symbol_groups as group}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={selected_group_id === group.id}>
							{#snippet child({ props })}
								<button {...props} onclick={() => (selected_group_id = group.id)}>{group.name}</button>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Content>
	</Sidebar.Root>
	<Sidebar.Inset>
		<div class="BlockPicker">
			<ul>
				{#each columns[0] as symbol (symbol.id)}
					<li>
						<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
					</li>
				{/each}
			</ul>
			<ul>
				{#each columns[1] as symbol (symbol.id)}
					<li>
						<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
					</li>
				{/each}
			</ul>
			<ul>
				{#each columns[2] as symbol (symbol.id)}
					<li>
						<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} site={$site_store} append={site_html} controls_enabled={false} />
					</li>
				{/each}
			</ul>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

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
</style>
