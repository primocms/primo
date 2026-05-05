<script lang="ts">
	import { Loader, Globe, Store, Check, SquarePen, Cuboid, ExternalLink, Upload } from 'lucide-svelte'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Input } from '$lib/components/ui/input/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import { Site } from '$lib/common/models/Site'
	import { Sites, SiteGroups, LibrarySymbols, SiteSnapshots } from '$lib/pocketbase/collections'
	import { page as pageState } from '$app/state'
	import Button from './ui/button/button.svelte'
	import { create_site_symbol_entries, create_site_symbol_fields, create_site_symbols } from '$lib/workers/CopySymbols.svelte'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Skeleton } from '$lib/components/ui/skeleton/index.js'
	import { marketplace, self } from '$lib/pocketbase/managers'
	import { watch } from 'runed'
	import BlockPickerPanel from '$lib/components/BlockPickerPanel.svelte'
	import { Snapshot } from '$lib/common/models/Snapshot'

	/*
  Create Site Wizard
  - Steps: name → starter → blocks
  - Flow: clone the selected starter via server-side endpoint, then optionally copy selected blocks.
  - Data sources: local PocketBase (manager/self) and marketplace (marketplace).
*/

	const { oncreated }: { oncreated?: (created: { id: string; host: string }) => void } = $props()

	const all_site_groups = $derived(SiteGroups.list({ sort: 'index' }) ?? [])
	// Prefer group named "Default"; otherwise fall back to the first group.
	const site_group = $derived(all_site_groups?.find((g) => g.name === 'Default') || all_site_groups?.[0])

	// Keep undefined until loaded so we can show skeletons
	const starter_sites = $derived(Sites.list({ sort: 'index' }) ?? undefined)
	// Starter groups sidebar state
	let active_starters_group_id = $state(all_site_groups?.[0]?.id ?? '')
	// When groups load/update, pick first available if none selected.
	watch(
		() => (all_site_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_starters_group_id && ids.length > 0) {
				active_starters_group_id = ids[0]
			}
		}
	)

	const active_starters_group_sites = $derived(starter_sites ? (active_starters_group_id ? starter_sites.filter((s) => s.group === active_starters_group_id) : starter_sites) : undefined)

	// Marketplace (Starters) - site groups and sites
	const marketplace_site_groups = $derived(SiteGroups.from(marketplace).list({ sort: 'index' }) ?? [])
	let active_marketplace_starters_group_id = $state(marketplace_site_groups?.find((g) => g.name === 'Featured')?.id ?? marketplace_site_groups?.[0]?.id ?? '')
	watch(
		() => (marketplace_site_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_marketplace_starters_group_id && ids.length > 0) {
				const groups = marketplace_site_groups ?? []
				active_marketplace_starters_group_id = groups.find((g) => g.name === 'Featured')?.id ?? ids[0]
			}
		}
	)

	const marketplace_starter_sites = $derived(
		active_marketplace_starters_group_id
			? (Sites.from(marketplace).list({ filter: { group: active_marketplace_starters_group_id }, sort: 'index' }) ?? undefined)
			: (Sites.from(marketplace).list({ sort: 'index' }) ?? undefined)
	)

	let site_name = $state(``)

	// Eagerly compute and load derived data when this component mounts
	$effect(() => {
		void all_site_groups
		void starter_sites
		void active_starters_group_sites
		void marketplace_site_groups
		void marketplace_starter_sites
	})

	// Stepper action: advance through steps; create on final step.
	function next_or_create() {
		if (step === 'name') {
			if (can_go_starter) step = 'starter'
			return
		}
		if (step === 'starter') {
			if (can_go_blocks) step = 'blocks'
			return
		}
		if (step === 'blocks') {
			create_site()
		}
	}

	let starter_tab = $state('sites')
	let selected_starter_id = $state(``)
	let selected_starter_source = $state<'local' | 'marketplace' | 'file'>('local')
	// Select a starter site by id and source.
	function select_starter(site_id: string, source: 'local' | 'marketplace' = 'local') {
		selected_starter_id = site_id
		selected_starter_source = source
		// Clear file selection when selecting a site
		uploaded_snapshot_file = null
		uploaded_snapshot = null
	}

	// File upload state
	let uploaded_snapshot_file: File | null = $state(null)
	let uploaded_snapshot: Snapshot | null = $state(null)
	let file_upload_error: string | null = $state(null)
	let parsing_file = $state(false)

	async function handle_file_upload(event: Event) {
		const input = event.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return

		file_upload_error = null
		parsing_file = true

		try {
			uploaded_snapshot = await Snapshot.decodeAsync(file)
			uploaded_snapshot_file = file
			selected_starter_source = 'file'
			selected_starter_id = '' // Clear site selection
		} catch (e) {
			console.error('Failed to parse snapshot file:', e)
			file_upload_error = e instanceof Error ? e.message : 'Invalid snapshot file'
			uploaded_snapshot_file = null
			uploaded_snapshot = null
		} finally {
			parsing_file = false
		}
	}

	function clear_uploaded_file() {
		uploaded_snapshot_file = null
		uploaded_snapshot = null
		file_upload_error = null
		selected_starter_source = 'local'
	}

	const selected_starter_site = $derived(
		selected_starter_source === 'local' ? (starter_sites ?? []).find((site) => site.id === selected_starter_id) : (marketplace_starter_sites ?? []).find((site) => site.id === selected_starter_id)
	)

	// Stepper state
	const step_order = ['name', 'starter', 'blocks'] as const
	let step = $state<(typeof step_order)[number]>('name')
	const can_go_starter = $derived(!!site_name)
	const can_go_blocks = $derived(!!site_name && (!!selected_starter_id || !!uploaded_snapshot))

	// Optional blocks selection; keep resolved symbol pointers only.
	let selected_block_ids = $state<{ id: string; source: 'library' | 'marketplace' }[]>([])
	const selected_blocks = $derived(selected_block_ids.map(({ id, source }) => (source === 'library' ? LibrarySymbols.one(id) : LibrarySymbols.from(marketplace).one(id))).filter(Boolean) || [])
	const selected_block_fields = $derived(selected_blocks.flatMap((symbol) => symbol?.fields()))
	const selected_block_entries = $derived(selected_blocks.flatMap((symbol) => symbol?.entries()))

	async function copy_selected_blocks_to_site() {
		try {
			if (!selected_block_ids.length) return

			const site = created_site
			const source_symbols = selected_blocks.filter((symbol) => !!symbol)
			const source_symbol_fields = selected_block_fields.filter((field) => !!field)
			const source_symbol_entries = selected_block_entries.filter((entry) => !!entry)

			const site_symbol_map = create_site_symbols({ source_symbols, site })
			const site_symbol_field_map = create_site_symbol_fields({ source_symbol_fields, site_symbol_map })
			const site_symbol_entry_map = create_site_symbol_entries({ source_symbol_entries, site_symbol_field_map })
		} catch (error) {
			console.error('Error copying marketplace symbols:', error)
			throw error
		}
	}

	const starter_snapshots = $derived(SiteSnapshots.from(marketplace).list({ sort: '-created' }))
	$effect(() => {
		// Ensure that snapshots get loaded
		starter_snapshots
	})

	let completed = $derived(Boolean(site_name && (selected_starter_id || uploaded_snapshot)))
	let loading = $state(false)
	let progress_message = $state('')
	let error_message = $state('')

	// Clone the selected starter via server-side endpoint
	async function create_site() {
		if (!selected_starter_id && !uploaded_snapshot_file) return
		loading = true
		error_message = ''
		progress_message = 'Creating site...'

		try {
			// Ensure default group exists
			if (!site_group) {
				SiteGroups.create({ name: 'Default', index: 0 })
				await self.commit()
			}

			let response: Response

			if (selected_starter_source === 'file' && uploaded_snapshot_file) {
				// File upload - use FormData
				const form_data = new FormData()
				form_data.append('name', site_name)
				form_data.append('host', pageState.url.host)
				form_data.append('group_id', site_group?.id ?? '')
				form_data.append('snapshot_file', uploaded_snapshot_file)

				response = await fetch(`${self.instance?.baseURL}/api/palacms/clone-site`, {
					method: 'POST',
					headers: {
						'Authorization': self.instance?.authStore.token ? `Bearer ${self.instance.authStore.token}` : ''
					},
					body: form_data
				})
			} else {
				// Build request body for server-side clone
				const request_body: {
					name: string
					host: string
					group_id: string
					source_site_id?: string
					snapshot_url?: string
				} = {
					name: site_name,
					host: pageState.url.host,
					group_id: site_group?.id ?? ''
				}

				if (selected_starter_source === 'marketplace') {
					// Get snapshot URL for marketplace clone
					const snapshot_record = starter_snapshots?.find((snapshot) => snapshot.site === selected_starter_id)
					if (!snapshot_record) {
						console.error('Snapshot not found. Selected starter:', selected_starter_id, 'Available snapshots:', starter_snapshots)
						throw new Error('Snapshot not found')
					}
					if (typeof snapshot_record.file !== 'string') {
						throw new Error('Invalid snapshot file. Please try a different starter.')
					}
					request_body.snapshot_url = `${marketplace.instance?.baseURL}/api/files/site_snapshots/${snapshot_record.id}/${snapshot_record.file}`
				} else {
					// Local clone
					request_body.source_site_id = selected_starter_id
				}

				// Call server-side clone endpoint
				response = await fetch(`${self.instance?.baseURL}/api/palacms/clone-site`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': self.instance?.authStore.token ? `Bearer ${self.instance.authStore.token}` : ''
					},
					body: JSON.stringify(request_body)
				})
			}

			if (!response.ok) {
				const error_data = await response.json().catch(() => ({}))
				throw new Error(error_data.message || `Clone failed: ${response.statusText}`)
			}

			const result = await response.json()
			created_site_id = result.id
			created_site_host = result.host
			done_creating_site = true

			// If no blocks to copy, finish immediately without waiting for
			// the reactive store to sync (avoids race condition on large templates)
			if (selected_block_ids.length === 0) {
				loading = false
				oncreated?.({ id: result.id, host: result.host })
				return
			}
		} catch (e) {
			console.error('Site creation error:', e)
			loading = false
			error_message = e instanceof Error ? e.message : 'An error occurred while creating the site'
		}
	}

	// Track the created site ID from server response
	let created_site_id = $state('')
	let created_site_host = $state('')

	// Find the created site - first try by ID from server response, then fall back to name match
	const created_sites = $derived(Sites.list({ filter: { host: pageState.url.host } }) ?? [])
	const created_site = $derived(
		created_site_id
			? (Sites.one(created_site_id) ?? created_sites.find((s) => s.id === created_site_id))
			: created_sites.find((s) => s.name === site_name)
	)

	// Finalize created site: copy optional blocks if any, then call oncreated.
	let done_creating_site = $state(false)
	let finalized = false
	$effect(() => {
		if (!finalized && done_creating_site && created_site) {
			finalized = true
			const created_payload = { id: created_site_id, host: created_site_host || created_site.host }
			// Copy optional blocks if any were selected
			if (selected_block_ids.length > 0) {
				copy_selected_blocks_to_site()
					.then(() => self.commit())
					.then(() => oncreated?.(created_payload))
					.catch((e) => console.error(e))
					.finally(() => {
						loading = false
					})
			} else {
				// No blocks to copy, just finish
				loading = false
				oncreated?.(created_payload)
			}
		}
	})
</script>

<div class="max-w-[1400px] h-screen px-2 flex flex-col mx-auto">
	<!-- Header -->
	<div class="pt-6 pb-6 h-[12vh] min-h-[7rem]">
		<h1 class="text-md leading-none tracking-tight text-center">Create Site</h1>

		<!-- Stepper -->
		<div class="max-w-[900px] mx-auto mt-4 flex items-center gap-4 overflow-x-auto whitespace-nowrap w-full">
			<!-- Step 1 -->
			<button class="flex items-center gap-3 focus:outline-none whitespace-nowrap" onclick={() => (step = 'name')}>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('name')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if can_go_starter}
						<Check class="w-4 h-4" />
					{:else}
						<SquarePen class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'name' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Enter Name</span>
			</button>

			<div class="border-t border-border h-px flex-1"></div>

			<!-- Step 2 -->
			<button
				class="flex items-center gap-3 focus:outline-none whitespace-nowrap {can_go_starter ? '' : 'opacity-50 pointer-events-none'}"
				onclick={() => (step = 'starter')}
				disabled={!can_go_starter}
			>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('starter')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if can_go_blocks}
						<Check class="w-4 h-4" />
					{:else}
						<Globe class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'starter' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Choose a Starter</span>
			</button>
			<div class="border-t border-border h-px flex-1"></div>

			<!-- Step 3 -->
			<button class="flex items-center gap-3 focus:outline-none whitespace-nowrap {can_go_blocks ? '' : 'opacity-50 pointer-events-none'}" onclick={() => (step = 'blocks')} disabled={!can_go_blocks}>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('blocks')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if selected_block_ids.length > 0}
						<Check class="w-4 h-4" />
					{:else}
						<Cuboid class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'blocks' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Add Blocks (optional)</span>
			</button>
		</div>
	</div>

	<!-- Content -->
	{#if step === 'name'}
		<!-- Identity -->
		<div class="rounded-lg border bg-[#111] p-4 shadow-sm w-full max-w-lg mx-auto">
			<form
				class="grid w-full items-center gap-1.5"
				onsubmit={(e) => {
					e.preventDefault()
					can_go_starter ? (step = 'starter') : null
				}}
			>
				<Label for="site-name">Site Name</Label>
				<Input
					type="text"
					id="site-name"
					value={site_name}
					oninput={(e) => {
						site_name = (e.currentTarget as HTMLInputElement).value.trim()
					}}
					autofocus
				/>
			</form>
		</div>
	{/if}

	{#if step === 'starter'}
		<Tabs.Root bind:value={starter_tab} class="h-[78vh] min-h-[30rem] w-full flex gap-4 flex-1 rounded-lg border bg-[#111] p-3 shadow-sm">
			<!-- Left: groups + grid -->
			<div class="flex flex-col flex-6">
				<Tabs.List
					class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full h-11 grid-cols-2 gap-1 p-1 text-sm font-semibold leading-[0.01em] dark:border dark:border-neutral-600/30"
				>
					<Tabs.Trigger value="sites" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<Globe class="h-4 w-4" />
						<span>Sites</span>
					</Tabs.Trigger>
					<Tabs.Trigger value="marketplace" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<Store class="h-4 w-4" />
						<span>Marketplace</span>
					</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="sites" class="flex overflow-hidden h-full">
					{#if active_starters_group_sites === undefined}
						<!-- Loading skeletons for local starters -->
						{#each Array.from({ length: 6 }) as _}
							<Skeleton class="aspect-video w-full" />
						{/each}
					{:else if starter_sites?.length === 0}
						<EmptyState
							class="h-full col-span-4"
							icon={Globe}
							title="No sites to display"
							description="You don't have any sites here yet. When you create one, you'll be able to use it as a starting point for other sites. In the meantime, check the marketplace."
							button={{
								label: 'Open Marketplace',
								icon: Store,
								onclick: () => (starter_tab = 'marketplace')
							}}
						/>
					{:else}
						<!-- Groups sidebar -->
						<div class="h-full md:border-r flex-1 flex flex-col">
							<div class="flex-1">
								<div class="p-2 text-xs text-muted-foreground">Groups</div>
								<ul class="p-2 pt-0 flex flex-col gap-1">
									{#each all_site_groups ?? [] as group (group.id)}
										<li>
											<button
												class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_starters_group_id === group.id ? 'bg-accent text-accent-foreground' : ''}"
												onclick={() => (active_starters_group_id = group.id)}
											>
												{group.name}
											</button>
										</li>
									{/each}
								</ul>
							</div>
							<!-- Import from file section -->
							<div class="border-t p-3">
								{#if uploaded_snapshot_file}
									<div class="rounded-md border bg-muted/50 p-2 space-y-2">
										<div class="flex items-center gap-2">
											<Check class="h-4 w-4 text-primary flex-shrink-0" />
											<span class="text-xs truncate">{uploaded_snapshot_file.name}</span>
										</div>
										<Button variant="ghost" size="sm" class="w-full h-7 text-xs" onclick={clear_uploaded_file}>
											Remove
										</Button>
									</div>
								{:else}
									<label class="flex items-center justify-center gap-2 w-full h-9 px-3 rounded-md border border-dashed cursor-pointer hover:bg-accent hover:border-accent-foreground/20 transition-colors text-sm text-muted-foreground hover:text-accent-foreground {parsing_file ? 'opacity-50 pointer-events-none' : ''}">
										{#if parsing_file}
											<Loader class="h-4 w-4 animate-spin" />
											<span>Reading...</span>
										{:else}
											<Upload class="h-4 w-4" />
											<span>Import .pala</span>
										{/if}
										<input
											type="file"
											class="hidden"
											accept=".pala"
											onchange={handle_file_upload}
											disabled={parsing_file}
										/>
									</label>
								{/if}
								{#if file_upload_error}
									<p class="text-xs text-destructive mt-2">{file_upload_error}</p>
								{/if}
							</div>
						</div>
						<!-- Server Sites grid -->
						<div class="flex-4 overflow-auto">
							{#if active_starters_group_sites?.length === 0}
								<div class="text-sm text-muted-foreground p-6 text-center">No sites in this group.</div>
							{:else if active_starters_group_sites}
								<div class="p-3 pr-0 grid gap-4 place-content-start sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
									{#each active_starters_group_sites as site}
										{@render StarterButton(site)}
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</Tabs.Content>

				<!-- Marketplace-->
				<Tabs.Content value="marketplace" class="flex overflow-hidden h-full">
					<!-- Groups sidebar -->
					<div class="h-full md:border-r flex-1">
						<div class="p-2 text-xs text-muted-foreground">Groups</div>
						<ul class="p-2 pt-0 flex flex-col gap-1">
							{#each marketplace_site_groups ?? [] as group (group.id)}
								<li>
									<button
										class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_marketplace_starters_group_id === group.id
											? 'bg-accent text-accent-foreground'
											: ''}"
										onclick={() => (active_marketplace_starters_group_id = group.id)}
									>
										{group.name}
									</button>
								</li>
							{/each}
						</ul>
					</div>
					<!-- Marketplace Sites grid -->
					<div class="flex-4 overflow-auto">
						<div class="p-3 pr-0 grid gap-4 col-span-3 place-content-start sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
							{#if marketplace_starter_sites === undefined}
								{#each Array.from({ length: 6 }) as _}
									<Skeleton class="aspect-video w-full" />
								{/each}
							{:else}
								{#each marketplace_starter_sites as site (site.id)}
									{@render StarterButton(site, 'marketplace')}
								{/each}
								{#if (marketplace_starter_sites?.length ?? 0) === 0}
									<div class="text-sm text-muted-foreground p-6 text-center">No starters in this group.</div>
								{/if}
							{/if}
						</div>
					</div>
				</Tabs.Content>
			</div>

			<!-- Right: preview takes 2/5 -->
			<div class="flex-3">
				<div class="h-[73vh] rounded-md bg-muted/20 flex flex-col overflow-hidden">
					{#if selected_starter_site}
						{@const preview_url = selected_starter_source === 'marketplace' ? `https://${selected_starter_site?.host}` : `/?_site=${selected_starter_site?.id}`}
						<div class="flex-1 min-h-0">
							{#key selected_starter_id}
								<SitePreview style="height: 100%; --thumbnail-height: 124%" site={selected_starter_site} src={selected_starter_site ? preview_url : ''} />
							{/key}
						</div>
						{#if preview_url}
							<div class="px-3 py-2 text-xs text-right text-muted-foreground relative bg-[#111]">
								<a href={preview_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 hover:text-foreground hover:underline">
									<span>Open live preview</span>
									<ExternalLink class="h-3 w-3" aria-hidden="true" />
								</a>
							</div>
						{/if}
					{:else if uploaded_snapshot}
						<div class="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center">
							<div class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
								<Check class="h-8 w-8 text-primary" />
							</div>
							<div>
								<p class="font-medium">{uploaded_snapshot.records.sites[0]?.name ?? 'Imported Site'}</p>
								<p class="text-sm text-muted-foreground mt-1">Ready to create</p>
							</div>
						</div>
					{:else}
						<div class="flex-1 flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
							<p class="text-xs text-muted-foreground/80 max-w-[14rem]">Choose a starter site on the left to see a live preview here.</p>
						</div>
					{/if}
				</div>
			</div>
		</Tabs.Root>
	{/if}

	{#if step === 'blocks'}
		<BlockPickerPanel bind:selected={selected_block_ids} />
	{/if}

	<!-- Footer -->
	<div class="h-[10vh] bg-background pt-4 pb-4 flex items-center z-10">
		<div class={step === 'name' ? 'w-full max-w-lg mx-auto flex justify-end gap-3' : 'w-full max-w-[1400px] mx-auto flex justify-end gap-3'}>
			<Button
				onclick={next_or_create}
				disabled={loading || (step === 'name' && !can_go_starter) || (step === 'starter' && !can_go_blocks) || (step === 'blocks' && !completed)}
				class="inline-flex justify-center items-center relative gap-2"
			>
				{step === 'blocks' ? 'Done' : 'Next'}
			</Button>
		</div>
	</div>
</div>

{#snippet StarterButton(site: Site, source: 'local' | 'marketplace' = 'local')}
	<button onclick={() => select_starter(site.id, source)} class="group relative w-full aspect-[.69] rounded-lg border bg-background overflow-hidden text-left">
		<div class="relative h-full">
			<!-- Ensure preview reserves the same height as the card to avoid tall grid rows -->
			<SitePreview {site} src={source === 'marketplace' ? `https://${site.host}` : undefined} />
			{#if selected_starter_id === site.id}
				<div class="pointer-events-none absolute inset-0 bg-[#000000AA] flex items-center justify-center">
					<Check class="text-primary" />
				</div>
			{/if}
		</div>
		<div class="absolute bottom-0 w-full p-3 z-20 bg-[#000] border-t">
			<div class="flex items-center gap-2">
				<div class="text-sm leading-none truncate">{site.name}</div>
				{#if source === 'marketplace'}
					<div class="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">Free</div>
				{/if}
			</div>
		</div>
	</button>
{/snippet}

<!-- Fullscreen loading overlay -->
{#if loading}
	<div class="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="flex flex-col items-center gap-4">
			<Loader class="h-12 w-12 animate-spin text-primary" />
			<p class="text-lg font-medium">{progress_message}</p>
		</div>
	</div>
{/if}

<!-- Error message display -->
{#if error_message}
	<div class="fixed bottom-4 right-4 z-50 max-w-md">
		<div class="bg-destructive text-destructive-foreground rounded-lg p-4 shadow-lg">
			<div class="flex items-start gap-3">
				<div class="flex-1">
					<p class="font-medium">Failed to create site</p>
					<p class="text-sm mt-1">{error_message}</p>
				</div>
				<button onclick={() => (error_message = '')} class="text-destructive-foreground/80 hover:text-destructive-foreground">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}
