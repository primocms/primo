<script lang="ts">
	import MarketplaceTabs from '$lib/components/MarketplaceTabs.svelte'
	import { rememberMarketplaceScroll } from '$lib/components/marketplace-navigation.svelte'

	import * as Popover from '$lib/components/ui/popover'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { Separator } from '$lib/components/ui/separator'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Cuboid, CirclePlus, CircleCheck } from 'lucide-svelte'
	import SymbolButton from '$lib/components/SymbolButton.svelte'
	import Masonry from '$lib/components/Masonry.svelte'
	import { Button, buttonVariants } from '$lib/components/ui/button'
	import { toast } from 'svelte-sonner'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { Label } from '$lib/components/ui/label'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { LibrarySymbolEntries, LibrarySymbolFields, LibrarySymbolGroups, LibrarySymbols } from '$lib/pocketbase/collections'
	import { marketplace, self } from '$lib/pocketbase/managers'
	import { last_library_group_id } from '$lib/builder/stores/app/misc'
	import { get } from 'svelte/store'
	import { watch } from 'runed'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	const group_id = $derived(page.url.searchParams.get('group') ?? undefined)
	const marketplace_symbol_group = $derived(group_id ? LibrarySymbolGroups.from(marketplace).one(group_id) : undefined)
	const marketplace_symbols = $derived(marketplace_symbol_group?.symbols() ?? undefined)
	const library_symbol_groups = $derived(LibrarySymbolGroups.list() ?? [])
	const marketplace_symbol_groups = $derived(LibrarySymbolGroups.from(marketplace).list({ sort: 'index' }) ?? [])

	// Auto-select first marketplace group if none is selected
	$effect(() => {
		if (!group_id && marketplace_symbol_groups.length > 0) {
			const url = new URL(page.url)
			url.searchParams.set('group', marketplace_symbol_groups[0].id)
			goto(url, { replaceState: true })
		}
	})

	// Prefer last-used group (persisted), fallback to first available
	let selected_group_id = $state((get(last_library_group_id) || LibrarySymbolGroups.list()?.[0]?.id) ?? '')
	let selected_symbol_id = $state<string>()
	let selected_symbol = $derived(selected_symbol_id ? LibrarySymbols.from(marketplace).one(selected_symbol_id) : null)
	let added_to_library = $state(false)
	async function add_to_library(sym?: ObjectOf<typeof LibrarySymbols> | string) {
		const symbolToAdd = typeof sym === 'string' ? LibrarySymbols.from(marketplace).one(sym) : sym || selected_symbol
		if (!symbolToAdd) {
			throw new Error('Selected symbol not loaded')
		}

		// Copy marketplace symbols to library symbols
		try {
			// Create library symbol from marketplace symbol
			const site_symbol = LibrarySymbols.create({
				name: symbolToAdd.name,
				html: symbolToAdd.html,
				css: symbolToAdd.css,
				js: symbolToAdd.js,
				group: selected_group_id
			})

			// Get marketplace fields using pb directly to avoid effect context issues
			const marketplace_fields = await marketplace.instance?.collection('library_symbol_fields').getFullList({
				filter: `symbol = "${symbolToAdd.id}"`,
				sort: 'index'
			})

			if (marketplace_fields?.length > 0) {
				const field_map = new Map()

				// Create fields in order, handling parent relationships
				const sorted_fields = [...marketplace_fields].sort((a, b) => {
					// Fields without parents come first
					if (!a.parent && b.parent) return -1
					if (a.parent && !b.parent) return 1
					return (a.index || 0) - (b.index || 0)
				})

				for (const marketplace_field of sorted_fields) {
					const parent_library_field = marketplace_field.parent ? field_map.get(marketplace_field.parent) : undefined

					const library_field = LibrarySymbolFields.create({
						key: marketplace_field.key,
						label: marketplace_field.label,
						type: marketplace_field.type,
						config: marketplace_field.config,
						index: marketplace_field.index,
						symbol: site_symbol.id,
						parent: parent_library_field?.id || undefined
					})
					field_map.set(marketplace_field.id, library_field)
				}

				// Get library entries using pb directly
				const field_ids = marketplace_fields.map((f) => f.id)
				const marketplace_entries =
					field_ids.length > 0
						? await marketplace.instance?.collection('library_symbol_entries').getFullList({
								filter: field_ids.map((id) => `field = "${id}"`).join(' || '),
								sort: 'index'
							})
						: []

				if (marketplace_entries?.length > 0) {
					const entry_map = new Map()

					// Create entries in order, handling parent relationships
					const sorted_entries = [...marketplace_entries].sort((a, b) => {
						// Entries without parents come first
						if (!a.parent && b.parent) return -1
						if (a.parent && !b.parent) return 1
						return (a.index || 0) - (b.index || 0)
					})

					for (const marketplace_entry of sorted_entries) {
						const library_field = field_map.get(marketplace_entry.field)
						const parent_library_entry = marketplace_entry.parent ? entry_map.get(marketplace_entry.parent) : undefined

						if (library_field) {
							const site_entry = LibrarySymbolEntries.create({
								field: library_field.id,
								value: marketplace_entry.value,
								index: marketplace_entry.index,
								locale: marketplace_entry.locale,
								parent: parent_library_entry?.id || undefined
							})
							entry_map.set(marketplace_entry.id, site_entry)
						}
					}
				}
			}
			await self.commit()
		} catch (error) {
			console.error('Error copying marketplace symbol:', error)
			throw error
		}
	}

	// Keep last selected group in session store (watch explicit source)
	watch(
		() => selected_group_id,
		(val) => {
			if (val) last_library_group_id.set(val)
		}
	)

	// If groups list updates and none selected, pick first available
	watch(
		() => (LibrarySymbolGroups.list() ?? []).map((g) => g.id),
		(ids) => {
			if (!selected_group_id && ids.length > 0) {
				selected_group_id = ids[0]
			}
		}
	)
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<MarketplaceTabs />
	</div>
</header>

<div use:rememberMarketplaceScroll={page.url.pathname + page.url.search} class="marketplace-content flex flex-1 flex-col gap-4">
	{#key group_id}
		{#if marketplace_symbols?.length || marketplace_symbols === undefined}
			<Masonry items={marketplace_symbols} loading={marketplace_symbols === undefined} skeletonCount={12}>
				{#snippet children(symbol)}
					<SymbolButton
						{symbol}
						show_price={true}
						onclick={() => {
							selected_symbol_id = symbol.id
						}}
					>
						<Popover.Root
							open={selected_symbol_id === symbol.id}
							onOpenChange={(open) => {
								if (!open) {
									selected_symbol_id = undefined
								}
							}}
						>
							<Popover.Trigger
								aria-label={`Add ${symbol.name || 'block'} to library`}
								class={buttonVariants({ variant: 'ghost', class: 'h-8 w-8 p-0 rounded-md text-[#b8b8c0] hover:bg-[#303034]' })}
								onclick={(event) => {
									event.preventDefault()
									selected_symbol_id = symbol.id
								}}
							>
								{#if added_to_library}
									<CircleCheck />
								{:else}
									<CirclePlus />
								{/if}
							</Popover.Trigger>
							<Popover.Content class="w-80">
								<div class="grid gap-4">
									<div class="space-y-2">
										<h4 class="font-medium leading-none">Add to Library</h4>
										<p class="text-muted-foreground text-sm">Select a group for this block</p>
									</div>
									<RadioGroup.Root bind:value={selected_group_id}>
										{#each library_symbol_groups ?? [] as group}
											<div class="flex items-center space-x-2">
												<RadioGroup.Item value={group.id} id={group.id} />
												<Label for={group.id}>{group.name}</Label>
											</div>
										{/each}
									</RadioGroup.Root>
									<div class="flex justify-end">
										<Button
											onclick={() => {
												const grp = LibrarySymbolGroups.one(selected_group_id)
												const displayName = (symbol?.name || '').trim() || 'Block'
												toast.success(`Added ${displayName} to ${grp?.name ?? 'Library'}`)
												selected_symbol_id = undefined
												added_to_library = true
												// Fire-and-forget background add
												add_to_library(symbol).catch((e) => {
													console.error(e)
													toast.error('Failed to add block. Please try again.')
													added_to_library = false
												})
											}}
										>
											Add to Library
										</Button>
									</div>
								</div>
							</Popover.Content>
						</Popover.Root>
					</SymbolButton>
				{/snippet}
			</Masonry>
		{:else}
			<EmptyState class="h-[50vh]" icon={Cuboid} title="No Blocks to display" description="Blocks are components you can add to any site. When you create one it'll show up here." />
		{/if}
	{/key}
</div>

<style lang="postcss">
	.marketplace-content :global(.masonry) {
		overflow: visible;
		flex-shrink: 0;
	}
	.marketplace-content {
		min-height: 0;
		overflow: auto;
		min-width: 0;
		padding: 0 24px 24px;
	}
	@media (max-width: 700px) {
		.marketplace-content {
			padding: 0 16px 16px;
		}
	}
	.marketplace-content :global(.masonry),
	.marketplace-content :global(.masonry > ul) {
		gap: 20px;
	}
</style>
