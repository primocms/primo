<script lang="ts">
	import './wizard.css'
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

<div class="block-picker">
	<div class="picker-main">
		<Tabs.Root bind:value={blocks_tab} onValueChange={handleTabChange} class="wizard-picker-tabs">
			<Tabs.List class="wizard-pill-tabs">
				<Tabs.Trigger value="library" class="wizard-pill-tab">
					<LibraryIcon class="h-4 w-4" />
					<span>Library</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="marketplace" class="wizard-pill-tab">
					<Store class="h-4 w-4" />
					<span>Marketplace</span>
				</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="library" class="wizard-tab-inner mt-0">
				{#if library_symbol_groups.length === 0}
					<EmptyState
						class="h-full"
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
					<div class="wizard-mobile-groups">
						{#each library_symbol_groups as group (group.id)}
							<button type="button" class="wizard-group-chip" aria-pressed={active_library_blocks_group_id === group.id} onclick={() => (active_library_blocks_group_id = group.id)}>{group.name}</button>
						{/each}
					</div>
					<div class="wizard-tab-split">
						<aside class="wizard-desktop-sidebar">
							<p class="wizard-group-label">Groups</p>
							<ul class="wizard-group-list">
								{#each library_symbol_groups as group (group.id)}
									<li>
										<button type="button" class="wizard-group-button" aria-pressed={active_library_blocks_group_id === group.id} onclick={() => (active_library_blocks_group_id = group.id)}>{group.name}</button>
									</li>
								{/each}
							</ul>
						</aside>
						<div class="wizard-grid-area">
							<Masonry columnCount={2} class="wizard-masonry-area" items={active_library_blocks_group_symbols} loading={active_library_blocks_group_symbols === undefined}>
								{#snippet children(symbol)}
									<div class="relative">
										<SymbolButton {symbol} onclick={() => toggle_block(symbol.id, 'library')} />
										{#if selected.some((block) => block.id === symbol.id)}
											<div class="wizard-starter-selected">
												<Check />
											</div>
										{/if}
									</div>
								{/snippet}
							</Masonry>
						</div>
					</div>
				{/if}
			</Tabs.Content>

			<Tabs.Content value="marketplace" class="wizard-tab-inner mt-0">
				<div class="wizard-mobile-groups">
					{#each marketplace_symbol_groups as group (group.id)}
						<button type="button" class="wizard-group-chip" aria-pressed={active_marketplace_blocks_group_id === group.id} onclick={() => (active_marketplace_blocks_group_id = group.id)}>{group.name}</button>
					{/each}
				</div>
				<div class="wizard-tab-split">
					<aside class="wizard-desktop-sidebar">
						<p class="wizard-group-label">Groups</p>
						<ul class="wizard-group-list">
							{#each marketplace_symbol_groups as group (group.id)}
								<li>
									<button type="button" class="wizard-group-button" aria-pressed={active_marketplace_blocks_group_id === group.id} onclick={() => (active_marketplace_blocks_group_id = group.id)}>{group.name}</button>
								</li>
							{/each}
						</ul>
					</aside>
					<div class="wizard-grid-area">
						<Masonry columnCount={2} class="wizard-masonry-area" items={active_marketplace_blocks_group_symbols} loading={active_marketplace_blocks_group_symbols === undefined}>
							{#snippet children(symbol)}
								<div class="relative">
									<SymbolButton {symbol} show_price={true} onclick={() => toggle_block(symbol.id, 'marketplace')} />
									{#if selected.some((block) => block.id === symbol.id)}
										<div class="wizard-starter-selected">
											<Check />
										</div>
									{/if}
								</div>
							{/snippet}
						</Masonry>
					</div>
				</div>
			</Tabs.Content>
		</Tabs.Root>
	</div>

	<!-- Right: Selected Blocks -->
	<div class="wizard-selected-panel picker-selected">
		<div class="wizard-selected-header">
			<div>
				<span>Selected Blocks</span>
				{#if selected_symbols.length > 0}
					<span>({selected_symbols.length})</span>
				{/if}
			</div>
			{#if selected_symbols.length > 0}
				<button type="button" onclick={() => (selected = [])}>Clear</button>
			{/if}
		</div>
		{#if selected_symbols.length > 0}
			<div class="wizard-selected-list">
				{#each selected_symbols as symbol (symbol?.id)}
					<div class="relative" animate:flip={{ duration: 100 }}>
						<SymbolButton {symbol} />
						<button type="button" class="picker-remove" onclick={() => remove_block(symbol.id)}>Remove</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="wizard-empty-note my-auto">Nothing added yet — select additional blocks to include in your site.</p>
		{/if}
	</div>
</div>

<style lang="postcss">
	.block-picker {
		flex: 1;
		min-height: 24rem;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow: hidden;
		border: 1px solid #36363a;
		border-radius: 8px;
		background: #202023;
		padding: 12px;
	}
	.picker-main {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.picker-remove {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 2px 6px;
		border: 1px solid #36363a;
		border-radius: 5px;
		background: #202023;
		color: #a5a5ad;
		font-size: 11px;
	}
	.picker-remove:hover {
		background: #303034;
		color: #f4f4f5;
	}
	.picker-remove:focus-visible {
		outline: 2px solid #c4c4ce;
		outline-offset: 2px;
	}

	/* Desktop: main + selected side by side */
	@media (min-width: 1024px) {
		.block-picker {
			flex-direction: row;
		}
		.picker-selected {
			width: 280px;
			flex-shrink: 0;
		}
	}
	/* Mobile: constrain the selected list so the grid stays usable */
	@media (max-width: 1023px) {
		.picker-selected {
			max-height: 40vh;
			flex-shrink: 0;
		}
	}
</style>
