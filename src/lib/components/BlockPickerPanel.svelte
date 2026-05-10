<script lang="ts">
	import { tick } from 'svelte'
	import { flip } from 'svelte/animate'
	import { watch } from 'runed'
	import { Store, Library as LibraryIcon, Check } from 'lucide-svelte'
	import * as Tabs from '$lib/components/ui/tabs'
	import Masonry from '$lib/components/Masonry.svelte'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import SymbolButton from '$lib/components/SymbolButton.svelte'
	import { LibrarySymbolGroups, LibrarySymbols } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { marketplace } from '$lib/pocketbase/managers'

	type BlockSource = 'library' | 'marketplace'
	type SelectedBlock = { id: string; source: BlockSource }

	let { selected = $bindable<SelectedBlock[]>([]) } = $props()

	let blocks_tab = $state('library')

	const library_symbol_groups = $derived(LibrarySymbolGroups.list({ sort: 'index' }) ?? [])
	const marketplace_symbol_groups = $derived(LibrarySymbolGroups.from(marketplace).list({ sort: 'index' }) ?? [])

	let active_library_blocks_group_id = $state('')
	let active_marketplace_blocks_group_id = $state('')

	watch(
		() => (library_symbol_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_library_blocks_group_id && ids.length > 0) {
				const groups = library_symbol_groups ?? []
				active_library_blocks_group_id = groups.find((g) => g.name === 'Featured')?.id ?? ids[0]
			}
		}
	)
	watch(
		() => (marketplace_symbol_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_marketplace_blocks_group_id && ids.length > 0) {
				const groups = marketplace_symbol_groups ?? []
				active_marketplace_blocks_group_id = groups.find((g) => g.name === 'Featured')?.id ?? ids[0]
			}
		}
	)

	const active_library_blocks_group = $derived(active_library_blocks_group_id ? LibrarySymbolGroups.one(active_library_blocks_group_id) : undefined)
	const active_library_blocks_group_symbols = $derived(active_library_blocks_group?.symbols() ?? undefined)

	const active_marketplace_blocks_group = $derived(active_marketplace_blocks_group_id ? LibrarySymbolGroups.from(marketplace).one(active_marketplace_blocks_group_id) : undefined)
	const active_marketplace_blocks_group_symbols = $derived(active_marketplace_blocks_group?.symbols() ?? undefined)

	const selected_symbols = $derived(
		selected
			.map(({ id, source }) => (source === 'library' ? LibrarySymbols.one(id) : LibrarySymbols.from(marketplace).one(id)))
			.filter((symbol): symbol is ObjectOf<typeof LibrarySymbols> => Boolean(symbol))
	)

	async function toggle_block(id: string, source: BlockSource) {
		const isSelected = selected.some((block) => block.id === id)
		if (isSelected) {
			selected = selected.filter((block) => block.id !== id)
		} else {
			selected = [{ id, source }, ...selected]
			await tick()
		}
	}

	function remove_block(id: string) {
		selected = selected.filter((block) => block.id !== id)
	}

	function handleTabChange(value: string) {
		if (value === 'library') {
			blocks_tab = 'library'
		} else if (value === 'marketplace') {
			blocks_tab = 'marketplace'
		}
	}
</script>

<Tabs.Root bind:value={blocks_tab} onValueChange={handleTabChange} class="h-[75vh] min-h-[30rem] w-full grid grid-cols-5 gap-4 flex-1 rounded-lg border bg-[#111] p-3 shadow-sm overflow-hidden">
	<div class="col-span-5 md:col-span-4 flex flex-col overflow-hidden">
		<Tabs.List class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full h-11 grid-cols-2 gap-1 p-1 text-sm font-semibold leading-[0.01em] dark:border dark:border-neutral-600/30">
			<Tabs.Trigger value="library" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
				<LibraryIcon class="h-4 w-4" />
				<span>Library</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="marketplace" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
				<Store class="h-4 w-4" />
				<span>Marketplace</span>
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="library" class="grid grid-cols-4 flex-1 min-h-0 overflow-hidden">
			{#if library_symbol_groups.length === 0}
				<EmptyState
					class="col-span-4"
					icon={LibraryIcon}
					title="Your Library is empty"
					description="Curate and create blocks in your Library. Add blocks from the Marketplace or create your own to reuse across sites."
					button={{
						label: 'Open Marketplace',
						icon: Store,
						onclick: () => (blocks_tab = 'marketplace')
					}}
				/>
			{:else}
				<div class="h-full md:border-r col-span-1 overflow-auto">
					<div class="p-2 text-xs text-muted-foreground">Groups</div>
					<ul class="p-2 pt-0 flex flex-col gap-1">
						{#each library_symbol_groups ?? [] as group (group.id)}
							<button
								class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_library_blocks_group_id === group.id ? 'bg-accent text-accent-foreground' : ''}"
								onclick={() => (active_library_blocks_group_id = group.id)}
							>
								{group.name}
							</button>
						{/each}
					</ul>
				</div>
				<Masonry columnCount={2} class="col-span-3 min-h-0 p-3 pr-0 overflow-auto" items={active_library_blocks_group_symbols} loading={active_library_blocks_group_symbols === undefined}>
					{#snippet children(symbol)}
						<div class="relative">
							<SymbolButton {symbol} onclick={() => toggle_block(symbol.id, 'library')} />
							{#if selected.some((block) => block.id === symbol.id)}
								<div class="pointer-events-none absolute inset-0 bg-[#000000AA] flex items-center justify-center">
									<Check class="text-primary" />
								</div>
							{/if}
						</div>
					{/snippet}
				</Masonry>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="marketplace" class="grid grid-cols-4 flex-1 min-h-0 overflow-hidden">
			<div class="h-full md:border-r col-span-1 overflow-scroll">
				<div class="p-2 text-xs text-muted-foreground">Groups</div>
				<ul class="p-2 pt-0 flex flex-col gap-1">
					{#each marketplace_symbol_groups ?? [] as group (group.id)}
						<li>
							<button
								class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_marketplace_blocks_group_id === group.id ? 'bg-accent text-accent-foreground' : ''}"
								onclick={() => (active_marketplace_blocks_group_id = group.id)}
							>
								{group.name}
							</button>
						</li>
					{/each}
				</ul>
			</div>
			<Masonry columnCount={2} class="col-span-3 min-h-0 p-3 pr-0 overflow-auto" items={active_marketplace_blocks_group_symbols} loading={active_marketplace_blocks_group_symbols === undefined}>
				{#snippet children(symbol)}
					<div class="relative">
						<SymbolButton {symbol} show_price={true} onclick={() => toggle_block(symbol.id, 'marketplace')} />
						{#if selected.some((block) => block.id === symbol.id)}
							<div class="pointer-events-none absolute inset-0 bg-[#000000AA] flex items-center justify-center">
								<Check class="text-primary" />
							</div>
						{/if}
					</div>
				{/snippet}
			</Masonry>
		</Tabs.Content>
	</div>

	<!-- Right: Selected Blocks -->
	<div class="col-span-5 md:col-span-1 rounded-lg border h-full px-3 flex flex-col overflow-hidden">
		<div class="py-2 text-xs border-b text-muted-foreground flex items-center justify-between">
			<div>
				<span>Selected Blocks</span>
				{#if selected_symbols.length > 0}
					<span class="text-xs text-muted-foreground">({selected_symbols.length})</span>
				{/if}
			</div>
			{#if selected_symbols.length > 0}
				<button class="text-xs underline" onclick={() => (selected = [])}>Clear</button>
			{/if}
		</div>
		{#if selected_symbols.length > 0}
			<div class="flex flex-col gap-3 sm:grid-cols-1 overflow-scroll mt-4 pb-3">
				{#each selected_symbols as symbol (symbol?.id)}
					<div class="relative" animate:flip={{ duration: 100 }}>
						<SymbolButton {symbol} />
						<button class="absolute top-2 right-2 text-xs bg-background/80 border rounded px-1" onclick={() => remove_block(symbol.id)}>Remove</button>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-sm text-muted-foreground p-6 text-center my-auto">Nothing added yet — select additional blocks to include in your site.</div>
		{/if}
	</div>
</Tabs.Root>
