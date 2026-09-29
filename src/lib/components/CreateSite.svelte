<script lang="ts">
	import './catalog-cards.css'
	import './wizard.css'
	import { Loader, Globe, Store, Check, SquarePen, Cuboid, ExternalLink, Upload, X, ChevronLeft } from 'lucide-svelte'
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
	import { track_site_created, track_operation_error, categorize_error } from '$lib/analytics'

	/*
  Create Site Wizard
  - Steps: name → starter → blocks
  - Flow: clone the selected starter via server-side endpoint, then optionally copy selected blocks.
  - Data sources: local PocketBase (manager/self) and marketplace (marketplace).
*/

	const { oncreated, oncancel }: { oncreated?: (created: { id: string; host: string }) => void; oncancel?: () => void } = $props()

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
	function go_back() {
		if (step === 'blocks') step = 'starter'
		else if (step === 'starter') step = 'name'
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
	const step_index = $derived(step_order.indexOf(step))
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
			// Ensure a default group exists. Capture the id locally — `site_group`
			// derives from the store and may not have re-synced right after the
			// commit, which would send an empty group_id and 400 the clone.
			let group_id = site_group?.id ?? ''
			if (!group_id) {
				const created_group = SiteGroups.create({ name: 'Default', index: 0 })
				await self.commit()
				group_id = created_group?.id ?? site_group?.id ?? ''
			}
			if (!group_id) {
				throw new Error('Could not resolve a site group')
			}

			let response: Response

			if (selected_starter_source === 'file' && uploaded_snapshot_file) {
				// File upload - use FormData
				const form_data = new FormData()
				form_data.append('name', site_name)
				// Host is intentionally omitted — new sites are created
				// unassigned (see clone-site endpoint) and get a real domain
				// assigned separately in the dashboard.
				form_data.append('group_id', group_id)
				form_data.append('snapshot_file', uploaded_snapshot_file)

				response = await fetch(`${self.instance?.baseURL}/api/primo/clone-site`, {
					method: 'POST',
					headers: {
						Authorization: self.instance?.authStore.token ? `Bearer ${self.instance.authStore.token}` : ''
					},
					body: form_data
				})
			} else {
				// Build request body for server-side clone
				const request_body: {
					name: string
					group_id: string
					source_site_id?: string
					snapshot_url?: string
				} = {
					name: site_name,
					// Host omitted — created unassigned (see clone-site endpoint).
					group_id
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
				response = await fetch(`${self.instance?.baseURL}/api/primo/clone-site`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: self.instance?.authStore.token ? `Bearer ${self.instance.authStore.token}` : ''
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
			track_site_created({ site_id: result.id, source: selected_starter_source })

			// If no blocks to copy, finish immediately without waiting for
			// the reactive store to sync (avoids race condition on large templates).
			// Mark finalized so the reactive finalize effect below doesn't fire
			// oncreated a second time once the store syncs.
			if (selected_block_ids.length === 0) {
				finalized = true
				loading = false
				oncreated?.({ id: result.id, host: result.host })
				return
			}
		} catch (e) {
			console.error('Site creation error:', e)
			loading = false
			error_message = e instanceof Error ? e.message : 'An error occurred while creating the site'
			track_operation_error({ operation: 'site_create', category: categorize_error(e) })
		}
	}

	// Track the created site ID from server response
	let created_site_id = $state('')
	let created_site_host = $state('')

	// Find the created site - first try by ID from server response, then fall back to name match
	const created_sites = $derived(Sites.list({ filter: { host: pageState.url.host } }) ?? [])
	const created_site = $derived(created_site_id ? (Sites.one(created_site_id) ?? created_sites.find((s) => s.id === created_site_id)) : created_sites.find((s) => s.name === site_name))

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

<div class="create-site-root">
	<header class="create-site-header">
		<div class="create-site-header-inner">
			<div class="create-site-titlebar">
				<h1>Create Site</h1>
				{#if oncancel}
					<button type="button" onclick={() => oncancel?.()} class="cancel-button" aria-label="Cancel">
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>

			<!-- Stepper -->
			<nav class="stepper" aria-label="Create site steps">
				{#each step_order as step_name, i (step_name)}
					{@const is_active = step === step_name}
					{@const is_done = step_index > i}
					{@const is_clickable = i === 0 || step_index >= i || (i === 1 ? can_go_starter : can_go_blocks)}
					<button
						class="step"
						data-state={is_active ? 'active' : is_done ? 'done' : 'todo'}
						onclick={() => (step = step_name)}
						disabled={!is_clickable}
						aria-current={is_active ? 'step' : undefined}
					>
						<span class="step-circle">
							{#if is_done || (step_name === 'name' && can_go_starter) || (step_name === 'starter' && can_go_blocks) || (step_name === 'blocks' && selected_block_ids.length > 0)}
								<Check class="h-4 w-4" />
							{:else if step_name === 'name'}
								<SquarePen class="h-4 w-4" />
							{:else if step_name === 'starter'}
								<Globe class="h-4 w-4" />
							{:else}
								<Cuboid class="h-4 w-4" />
							{/if}
						</span>
						<span class="step-label">
							{#if step_name === 'name'}Enter Name{:else if step_name === 'starter'}Choose a Starter{:else}Add Blocks (optional){/if}
						</span>
					</button>
					{#if i < step_order.length - 1}
						<span class="step-connector" aria-hidden="true"></span>
					{/if}
				{/each}
			</nav>
		</div>
	</header>

	<!-- Content -->
	<div class="create-site-body">
		{#if step === 'name'}
			<!-- Identity -->
			<div class="name-panel">
				<form
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
					<p class="name-hint">You'll pick a starting design next — or import a .primo file.</p>
				</form>
			</div>
		{/if}

		{#if step === 'starter'}
			<div class="starter-layout">
				<Tabs.Root bind:value={starter_tab} class="wizard-panel wizard-starter-tabs">
					<Tabs.List class="wizard-pill-tabs">
						<Tabs.Trigger value="sites" class="wizard-pill-tab">
							<Globe class="h-4 w-4" />
							<span>Sites</span>
						</Tabs.Trigger>
						<Tabs.Trigger value="marketplace" class="wizard-pill-tab">
							<Store class="h-4 w-4" />
							<span>Marketplace</span>
						</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content value="sites" class="wizard-tab-inner mt-0">
						{@render StarterGroupContent(
							all_site_groups,
							active_starters_group_id,
							(id) => (active_starters_group_id = id),
							active_starters_group_sites,
							'local',
							true,
							starter_sites?.length === 0
								? {
										icon: Globe,
										title: 'No sites to display',
										description: "You don't have any sites here yet. When you create one, you'll be able to use it as a starting point for other sites. In the meantime, check the marketplace.",
										button: { label: 'Open Marketplace', icon: Store, onclick: () => (starter_tab = 'marketplace') }
									}
								: null
						)}
					</Tabs.Content>
					<Tabs.Content value="marketplace" class="wizard-tab-inner mt-0">
						{@render StarterGroupContent(marketplace_site_groups, active_marketplace_starters_group_id, (id) => (active_marketplace_starters_group_id = id), marketplace_starter_sites, 'marketplace', false, null)}
					</Tabs.Content>
				</Tabs.Root>

				<!-- Right: live preview -->
				<aside class="wizard-preview">
					<div class="wizard-preview-box">
						{#if selected_starter_site}
							{@const preview_url = selected_starter_source === 'marketplace' ? `https://${selected_starter_site?.host}` : `/?_site=${selected_starter_site?.id}`}
							<div class="wizard-preview-frame">
								{#key selected_starter_id}
									<SitePreview style="height: 100%; --thumbnail-height: 124%" site={selected_starter_site} src={selected_starter_site ? preview_url : ''} />
								{/key}
							</div>
							{#if preview_url}
								<div class="wizard-preview-link">
									<a href={preview_url} target="_blank" rel="noopener noreferrer">
										<span>Open live preview</span>
										<ExternalLink class="h-3 w-3" aria-hidden="true" />
									</a>
								</div>
							{/if}
						{:else if uploaded_snapshot}
							<div class="wizard-preview-empty">
								<div class="wizard-preview-check">
									<Check />
								</div>
								<p class="wizard-preview-title">{uploaded_snapshot.records.sites[0]?.name ?? 'Imported Site'}</p>
								<p class="wizard-preview-note">Ready to create</p>
							</div>
						{:else}
							<div class="wizard-preview-empty">
								<p class="wizard-preview-note">Choose a starter site on the left to see a live preview here.</p>
							</div>
						{/if}
					</div>
				</aside>
			</div>
		{/if}

		{#if step === 'blocks'}
			<div class="blocks-step">
				<BlockPickerPanel bind:selected={selected_block_ids} />
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<footer class="create-site-footer">
		<div class="create-site-footer-inner">
			{#if step !== 'name' && !loading}
				<button type="button" class="back-button" onclick={go_back}>
					<ChevronLeft class="h-4 w-4" />
					<span>Back</span>
				</button>
			{/if}
			<div class="footer-actions">
				<Button
					onclick={next_or_create}
					disabled={loading || (step === 'name' && !can_go_starter) || (step === 'starter' && !can_go_blocks) || (step === 'blocks' && !completed)}
					class="next-button"
				>
					{step === 'blocks' ? 'Create Site' : 'Next'}
				</Button>
			</div>
		</div>
	</footer>
</div>

{#snippet StarterGroupContent(groups, active_group_id, select_group, sites, source, show_import, empty)}
	<div class="wizard-tab-inner">
		<!-- Mobile: group chips + import -->
		<div class="wizard-mobile-groups">
			{#each groups as group (group.id)}
				<button class="wizard-group-chip" aria-pressed={active_group_id === group.id} onclick={() => select_group(group.id)}>{group.name}</button>
			{/each}
			{#if show_import}
				<div class="wizard-mobile-import">{@render ImportFile()}</div>
			{/if}
		</div>
		<div class="wizard-tab-split">
			<!-- Desktop: groups sidebar -->
			<aside class="wizard-desktop-sidebar">
				<div class="sidebar-groups">
					<p class="wizard-group-label">Groups</p>
					<ul class="wizard-group-list">
						{#each groups as group (group.id)}
							<li>
								<button class="wizard-group-button" aria-pressed={active_group_id === group.id} onclick={() => select_group(group.id)}>{group.name}</button>
							</li>
						{/each}
					</ul>
				</div>
				{#if show_import}
					<div class="wizard-import-zone">{@render ImportFile()}</div>
				{/if}
			</aside>
			<!-- Starter grid -->
			<div class="wizard-grid-area">
				{#if sites === undefined}
					<div class="wizard-starter-grid">
						{#each Array.from({ length: 6 }) as _}
							<Skeleton class="aspect-video w-full" />
						{/each}
					</div>
				{:else if sites.length === 0 && empty}
					<EmptyState class="h-full" icon={empty.icon} title={empty.title} description={empty.description} button={empty.button} />
				{:else if sites.length === 0}
					<p class="wizard-empty-note">No starters in this group.</p>
				{:else}
					<div class="wizard-starter-grid">
						{#each sites as site (site.id)}
							{@render StarterButton(site, source)}
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

{#snippet ImportFile()}
	{#if uploaded_snapshot_file}
		<div class="wizard-imported">
			<div class="wizard-imported-name">
				<Check class="h-3.5 w-3.5" />
				<span>{uploaded_snapshot_file.name}</span>
			</div>
			<Button variant="ghost" size="sm" class="wizard-imported-remove" onclick={clear_uploaded_file}>Remove</Button>
		</div>
	{:else}
		<label class="wizard-import-button" class:is-loading={parsing_file}>
			{#if parsing_file}
				<Loader class="h-4 w-4 animate-spin" />
				<span>Reading...</span>
			{:else}
				<Upload class="h-4 w-4" />
				<span>Import .primo</span>
			{/if}
			<input type="file" class="hidden" accept=".primo,.pala" onchange={handle_file_upload} disabled={parsing_file} />
		</label>
	{/if}
	{#if file_upload_error}
		<p class="wizard-import-error">{file_upload_error}</p>
	{/if}
{/snippet}

{#snippet StarterButton(site: Site, source: 'local' | 'marketplace' = 'local')}
	<button onclick={() => select_starter(site.id, source)} class="catalog-card wizard-starter-card" type="button" aria-pressed={selected_starter_id === site.id}>
		<span class="catalog-preview">
			<SitePreview {site} src={source === 'marketplace' ? `https://${site.host}` : undefined} style="--thumbnail-height: 100%; background: #27272b;" />
		</span>
		<span class="catalog-footer">
			<span class="catalog-identity">
				<span class="catalog-name">{site.name}</span>
				{#if source === 'marketplace'}
					<span class="catalog-price">Free</span>
				{/if}
			</span>
		</span>
		{#if selected_starter_id === site.id}
			<span class="wizard-starter-selected">
				<Check />
			</span>
		{/if}
	</button>
{/snippet}

<!-- Fullscreen loading overlay -->
{#if loading}
	<div class="loading-overlay">
		<div class="loading-overlay-inner">
			<Loader class="h-12 w-12 animate-spin" />
			<p>{progress_message}</p>
		</div>
	</div>
{/if}

<!-- Error message display -->
{#if error_message}
	<div class="error-toast">
		<div class="error-toast-inner">
			<div class="error-toast-body">
				<p class="font-medium">Failed to create site</p>
				<p class="error-toast-message">{error_message}</p>
			</div>
			<button onclick={() => (error_message = '')} aria-label="Dismiss error">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style lang="postcss">
	.create-site-root {
		height: 100%;
		/* The /admin/site route mounts the wizard in an unsized parent, where
		height: 100% resolves to auto and the picker grows the whole page.
		Cap at the viewport so panes scroll internally on both routes. */
		max-height: 100dvh;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: #1e1e21;
		color: #f4f4f5;
	}

	/* Header */
	.create-site-header {
		flex-shrink: 0;
		background: #171719;
		border-bottom: 1px solid #303034;
	}
	.create-site-header-inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 12px 16px 14px;
	}
	.create-site-titlebar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.create-site-titlebar h1 {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
		letter-spacing: -0.01em;
	}
	.cancel-button {
		position: absolute;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		color: #a5a5ad;
	}
	.cancel-button:hover {
		background: #303034;
		color: #f4f4f5;
	}
	.cancel-button:focus-visible {
		outline: 2px solid #c4c4ce;
		outline-offset: 2px;
	}

	/* Stepper */
	.stepper {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 900px;
		width: 100%;
		margin: 14px auto 0;
		overflow-x: auto;
		padding-bottom: 2px;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	.step:disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	.step-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border: 1px solid #36363a;
		border-radius: 50%;
		background: #202023;
		color: #a5a5ad;
		font-size: 13px;
	}
	.step[data-state='active'] .step-circle {
		background: #39393f;
		border-color: #45454c;
		color: #f4f4f5;
		box-shadow: 0 1px 3px #0003;
	}
	.step[data-state='done'] .step-circle {
		border-color: #45454c;
		color: #f4f4f5;
	}
	.step-label {
		font-size: 12px;
		white-space: nowrap;
		color: #a5a5ad;
	}
	.step[data-state='active'] .step-label {
		color: #f4f4f5;
		font-weight: 500;
	}
	.step:focus-visible {
		outline: 2px solid #c4c4ce;
		outline-offset: 2px;
		border-radius: 6px;
	}
	.step-connector {
		flex: 1;
		min-width: 12px;
		height: 1px;
		background: #303034;
	}

	/* Body */
	.create-site-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 1400px;
		margin: 0 auto;
		padding: 16px;
	}

	/* Name step */
	.name-panel {
		width: 100%;
		max-width: 520px;
		margin: auto;
		padding: 20px;
		border: 1px solid #36363a;
		border-radius: 8px;
		background: #202023;
		box-shadow: 0 2px 8px #0002;
	}
	.name-panel label {
		color: #a5a5ad;
		font-size: 12px;
	}
	.name-panel :global(input) {
		margin-top: 8px;
	}
	.name-hint {
		margin: 10px 0 0;
		font-size: 12px;
		line-height: 1.5;
		color: #a5a5ad;
	}

	/* Starter step */
	.starter-layout {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: 14px;
	}
	.sidebar-groups {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	.wizard-mobile-import {
		flex-shrink: 0;
		width: 210px;
		margin-left: 6px;
	}

	/* Blocks step */
	.blocks-step {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* Footer */
	.create-site-footer {
		flex-shrink: 0;
		background: #171719;
		border-top: 1px solid #303034;
	}
	.create-site-footer-inner {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		max-width: 1400px;
		margin: 0 auto;
		padding: 10px 16px;
	}
	.footer-actions {
		display: flex;
		align-items: center;
	}
	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 34px;
		padding: 6px 12px;
		border: 1px solid #36363a;
		border-radius: 6px;
		background: #202023;
		color: #a5a5ad;
		font-size: 12px;
		font-weight: 500;
		margin-right: auto;
	}
	.back-button:hover {
		background: #303034;
		color: #f4f4f5;
	}
	.back-button:focus-visible {
		outline: 2px solid #c4c4ce;
		outline-offset: 2px;
	}
	:global(.next-button) {
		min-height: 34px;
		padding: 6px 14px;
		border-radius: 6px;
		background: #ededf0;
		color: #202023;
		font-size: 12px;
		font-weight: 500;
		box-shadow: 0 1px 2px #0003;
	}
	:global(.next-button:hover) {
		background: white;
	}
	:global(.next-button:disabled) {
		opacity: 0.5;
		pointer-events: none;
	}

	/* Loading overlay */
	.loading-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(23, 23, 25, 0.95);
		backdrop-filter: blur(4px);
	}
	.loading-overlay-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		color: var(--primo-primary-color, #ff6b35);
	}
	.loading-overlay-inner p {
		margin: 0;
		font-size: 16px;
		font-weight: 500;
		color: #f4f4f5;
	}

	/* Error toast */
	.error-toast {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 50;
		max-width: 420px;
	}
	.error-toast-inner {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px 16px;
		border-radius: 8px;
		background: #7f1d1d;
		color: #fecaca;
		box-shadow: 0 8px 24px #0006;
	}
	.error-toast-body {
		flex: 1;
	}
	.error-toast-message {
		margin: 4px 0 0;
		font-size: 13px;
	}
	.error-toast-inner button {
		opacity: 0.8;
	}
	.error-toast-inner button:hover {
		opacity: 1;
	}

	/* Mobile */
	@media (max-width: 640px) {
		.step-label {
			display: none;
		}
		.step[data-state='active'] .step-label {
			display: inline;
		}
		.create-site-header-inner {
			padding: 10px 12px 12px;
		}
		.create-site-body {
			padding: 12px;
		}
		.starter-layout {
			gap: 0;
		}
		.wizard-mobile-import {
			width: auto;
			margin-left: 0;
		}
		.wizard-mobile-import .wizard-imported {
			max-width: 220px;
		}
	}
</style>
