<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { fade } from 'svelte/transition'
	import { find as _find } from 'lodash-es'
	import Icon from '@iconify/svelte'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import ToolbarButton from './ToolbarButton.svelte'
	import { PrimoButton } from '$lib/builder/components/buttons'
	import { mod_key_held } from '$lib/builder/stores/app/misc'
	import { onNavigate, goto } from '$app/navigation'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { page, page as pageState } from '$app/state'
	import { PageTypes, SiteSnapshots } from '$lib/pocketbase/collections'
	import { onModKey } from '$lib/builder/utils/keyboard'
	import { is_host_assigned } from '$lib/site_host'
	import * as Popover from '$lib/components/ui/popover/index.js'
	import SiteEditor from '$lib/builder/views/modal/SiteEditor/SiteEditor.svelte'
	import SitePages from '$lib/builder/views/modal/SitePages/SitePages.svelte'
	import PageTypeModal from '$lib/builder/views/modal/PageTypeModal/PageTypeModal.svelte'
	import Collaboration from '$lib/builder/views/modal/Collaboration.svelte'
	import Deploy from '$lib/components/Modals/Deploy/Deploy.svelte'
	import ConnectDomain from '$lib/components/ConnectDomain.svelte'
	import { usePublishSite } from '$lib/workers/Publish.svelte'
	import { type Snippet } from 'svelte'
	import { site_context } from '$lib/builder/stores/context'
	import { current_user } from '$lib/pocketbase/user'
	import { resolve_page, build_cms_page_url } from '$lib/pages'
	import { self } from '$lib/pocketbase/managers'
	import { getUserActivity } from '$lib/UserActivity.svelte'
	import { useSiteSnapshot } from '$lib/Snapshot.svelte'
	import { Snapshot } from '$lib/common/models/Snapshot'
	import { instance } from '$lib/instance'
	import { read_only } from '$lib/pocketbase/author_mode'
	import BrowseModePill from './BrowseModePill.svelte'
	import { track_site_published, track_operation_error, categorize_error } from '$lib/analytics'

	let { children }: { children: Snippet } = $props()

	// Read the site through the context reactively. Destructuring it here
	// (`const { value: site } = …`) snapshots it once at mount, so an in-place
	// update to the cached record — e.g. `update_record` after the domain
	// endpoints return — never re-renders the toolbar, and the publish dialog
	// keeps showing its stale (empty) host until a reload. Reading `value`
	// inside a $derived keeps the dependency live.
	const site_context_value = site_context.get()
	const site = $derived(site_context_value.value)
	const homepage = $derived(site.homepage())

	const active_page_path = $derived(pageState.params.page?.split('/'))
	const active_page = $derived(active_page_path ? resolve_page(site, active_page_path) : homepage)
	const active_page_page_type = $derived(active_page && PageTypes.one(active_page.page_type))

	const active_page_type_id = $derived(pageState.params.page_type)
	const active_page_type = $derived(active_page_type_id && PageTypes.one(active_page_type_id))

	const publish = $derived(usePublishSite(site?.id))

	const existing_snapshots = $derived(SiteSnapshots.list({ filter: { site: site.id }, sort: '-created' }))
	const create_snapshot = $derived(useSiteSnapshot({ source_site_id: site?.id }))

	let publish_in_progress = $state(false)
	// Both workers lazily load the whole site (site → pages → sections →
	// symbols → fields → entries) as part of run(), and read it as one
	// all-or-nothing aggregate. On a site created moments ago that aggregate
	// can still be settling when the work runs, so the worker throws a bare
	// 'Not loaded' — which surfaced as "Publishing failed" on a brand-new site.
	// run() returns the worker to standby on failure, so waiting a beat and
	// retrying once is safe; only a genuine failure survives both attempts.
	async function run_when_loaded<T>(worker: { run: () => Promise<T> }): Promise<T> {
		try {
			return await worker.run()
		} catch (e) {
			if (!(e instanceof Error) || e.message !== 'Not loaded') throw e
			await new Promise((resolve) => setTimeout(resolve, 500))
			try {
				return await worker.run()
			} catch (retry) {
				if (retry instanceof Error && retry.message === 'Not loaded') {
					throw new Error('This site was still loading. Try publishing again.')
				}
				throw retry
			}
		}
	}

	async function handle_publish() {
		publish_in_progress = true
		try {
			await run_when_loaded(publish)

			// Create new snapshot and remove all other ones
			// TODO: The amount of snapshots could be larger once make UI for managing and restoring them
			const snapshots_to_remove = [...(existing_snapshots ?? [])]
			const snapshot = await run_when_loaded(create_snapshot)
			SiteSnapshots.create({
				site: site.id,
				file: Snapshot.encode(snapshot)
			})
			for (const existing_snapshot of snapshots_to_remove) {
				SiteSnapshots.delete(existing_snapshot.id)
			}
			await self.commit()
			track_site_published({ site_id: site.id })
		} catch (e) {
			track_operation_error({ operation: 'publish', category: categorize_error(e), site_id: site.id })
			throw e
		} finally {
			publish_in_progress = false
		}
	}

	let going_up = $state(false)
	let going_down = $state(false)

	const all_pages = $derived(site?.pages() ?? [])

	const pages_at_current_level = $derived.by(() => {
		if (!active_page || !homepage) return []
		if (active_page.id === homepage.id || active_page.parent === homepage.id) return [homepage, ...all_pages.filter((p) => p.parent === homepage.id)].sort((a, b) => b.index - a.index) // home page or direct sibling (descending order)
		return all_pages.filter((p) => p.parent === active_page?.parent).sort((a, b) => b.index - a.index) // standard children (descending order)
	})

	const can_navigate_up = $derived(active_page ? active_page.index > 0 : false)
	const can_navigate_down = $derived(active_page ? active_page.index < pages_at_current_level.length - 1 : false)

	// Navigation functions
	function navigate_up() {
		if (!can_navigate_up || !active_page) return
		going_up = true
		const prev_page = pages_at_current_level.find((p) => p.index === active_page.index - 1)
		if (!prev_page) return
		const url = build_cms_page_url(prev_page, pageState.url)
		if (url) goto(url, { replaceState: false })
		setTimeout(() => (going_up = false), 150)
	}

	function navigate_down() {
		if (!can_navigate_down || !active_page) return
		going_down = true
		const next_page = pages_at_current_level.find((p) => p.index === active_page.index + 1)
		if (!next_page) return
		const url = build_cms_page_url(next_page, pageState.url)
		if (url) goto(url, { replaceState: false })
		setTimeout(() => (going_down = false), 150)
	}


	let editing_site = $state(false)
	let site_has_unsaved_changes = $state(false)
	let editing_pages = $state(false)
	let editing_page_types = $state(false)
	let editing_collaborators = $state(false)
	let publishing = $state(false)
	let publish_stage = $state('INITIAL')
	let connect_domain_open = $state(false)

	// Close all dialogs on navigation
	onNavigate(() => {
		editing_pages = false
		editing_page_types = false
		publishing = false
		publish_stage = 'INITIAL'
	})

	// workaround for what seems to be a runed PressedKeys bugs when holding mod and pressing up/down keys
	function handleGlobalKeydown(e) {
		const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
		if (!(isMac ? e.metaKey : e.ctrlKey)) return
		if (e.key === 'ArrowUp') {
			e.preventDefault()
			navigate_up()
		} else if (e.key === 'ArrowDown') {
			e.preventDefault()
			navigate_down()
		}
	}

	// Add the global listener on mount
	$effect(() => {
		window.addEventListener('keydown', handleGlobalKeydown)

		return () => {
			window.removeEventListener('keydown', handleGlobalKeydown)
		}
	})

	onModKey('p', () => {
		// Browse mode hides the publish button; the hotkey has to match or the
		// dialog stays reachable.
		if ($read_only) return
		publishing = true
	})

	const user_activities = $derived(getUserActivity())
</script>

<Dialog.Root
	bind:open={editing_site}
	onOpenChange={(open) => {
		if (!open) {
			if (site_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					editing_site = true
					return
				}
			}
			self.discard()
		}
	}}
>
	<Dialog.Content class="z-999 w-[calc(100vw-1rem)] max-w-none h-[calc(100vh-1rem)] max-h-none flex flex-col p-4">
		<SiteEditor onClose={() => (editing_site = false)} bind:has_unsaved_changes={site_has_unsaved_changes} />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_pages}>
	<Dialog.Content class="z-999 w-[calc(100vw-1rem)] max-w-[720px] min-h-[260px] max-h-[min(80dvh,640px)] flex flex-col gap-4 bg-[#1e1e20] border-[#343437] p-5">
		<SitePages onManagePageTypes={($current_user?.siteRole === 'developer' || $current_user?.serverRole === 'developer') ? () => {
			editing_pages = false
			editing_page_types = true
		} : undefined} />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_page_types}>
	<Dialog.Content class="z-999 max-w-[900px] h-[calc(100vh-1rem)] max-h-none flex flex-col p-4">
		<PageTypeModal />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_collaborators}>
	<Dialog.Content class="z-999 max-w-[600px] flex flex-col p-4">
		<Collaboration {site} />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={publishing}
	onOpenChange={(open) => {
		if (!open) {
			// Reset the state
			publish_stage = 'INITIAL'
		}
	}}
>
	<Dialog.Content class="z-[999] w-[calc(100vw-1rem)] max-w-[500px] max-h-[calc(100dvh-1rem)] overflow-y-auto flex flex-col p-0 bg-[#1e1e20] border-[#343437]">
		<Deploy
			bind:stage={publish_stage}
			publish_fn={handle_publish}
			loading={publish_in_progress}
			site_host={site && is_host_assigned(site) ? site.host : ''}
			onConnectDomain={() => {
				publishing = false
				publish_stage = 'INITIAL'
				connect_domain_open = true
			}}
			onClose={() => {
				publishing = false
				publish_stage = 'INITIAL'
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<ConnectDomain {site} bind:open={connect_domain_open} onconnected={(result) => self.update_record(site.id, { host: result.host, domain_status: result.status })} />

<nav aria-label="toolbar" id="primo-toolbar">
	<div class="menu-container">
		<div class="left">
			{#if $current_user?.serverRole}
				<PrimoButton />
			{/if}
			<div class="button-group">
				<div class="navigation-group">
					<!-- <ToolbarButton label="Site" icon="gg:website" on:click={() => modal.show('SITE_EDITOR', {}, { showSwitch: true, disabledBgClose: true })} /> -->
					<ToolbarButton label="Site content" title="Content shared across your site." icon="gg:website" on:click={() => (editing_site = true)} />
				</div>
			</div>
			<div class="button-group">
				{#if $mod_key_held}
					<div class="page-hotkeys">
						<div style:color={going_up ? 'var(--primo-primary-color)' : 'inherit'} style:opacity={can_navigate_up ? 1 : 0.3}>&#8984; ↑</div>
						<div style:color={going_down ? 'var(--primo-primary-color)' : 'inherit'} style:opacity={can_navigate_down ? 1 : 0.3}>&#8984; ↓</div>
					</div>
				{:else}
					<div class="navigation-group">
						<ToolbarButton label="Pages" icon="iconoir:multiple-pages" on:click={() => (editing_pages = true)} />
					</div>
				{/if}
			</div>
		</div>
		<div class="site-name">
			<span class="site">{site?.name}</span>
			{#if active_page_type}
				<span class="separator">/</span>
				<div class="page-type" style:background={active_page_type.color}>
					<Icon icon={active_page_type.icon} />
					<span>{active_page_type.name}</span>
				</div>
			{:else if active_page}
				<span class="separator">/</span>
				<span class="page">{active_page.name}</span>
				{#if active_page_page_type}
					{#if $current_user?.siteRole === 'developer'}
						{@const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'}
						<a class="page-type-badge" style="background-color: {active_page_page_type.color};" href="{base_path}/page-type--{active_page_page_type.id}">
							<Icon icon={active_page_page_type.icon} />
						</a>
					{:else}
						<span class="page-type-badge" style="background-color: {active_page_page_type.color};">
							<Icon icon={active_page_page_type.icon} />
						</span>
					{/if}
				{/if}
			{/if}
		</div>
		<div class="right">
			<div class="flex -space-x-1">
				{#each user_activities as activities}
					{@const { user, user_avatar } = activities[0]}
					<div class="flex" transition:fade>
						<Popover.Root>
							<Popover.Trigger>
								<Avatar.Root class="ring-background transition-all ring-2 size-[27px]">
									{#if user_avatar}
										<Avatar.Image src={user_avatar} alt={user.name || user.email} class="grayscale hover:grayscale-0 object-cover object-center" />
									{/if}
									<Avatar.Fallback>{(user.name || user.email).slice(0, 2).toUpperCase()}</Avatar.Fallback>
								</Avatar.Root>
							</Popover.Trigger>
							<Popover.Content class="w-auto z-[99]">
								<div class="flex space-x-4">
									<Avatar.Root class="data-[status=loaded]:border-foreground bg-muted text-muted-foreground h-12 w-12 rounded-full border border-transparent text-[17px] font-medium uppercase">
										<div class="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-transparent">
											{#if user_avatar}
												<Avatar.Image src={user_avatar} alt={user.name || user.email} class="object-cover object-center" />
											{/if}
											<Avatar.Fallback class="border-muted border">{(user.name || user.email).slice(0, 2).toUpperCase()}</Avatar.Fallback>
										</div>
									</Avatar.Root>
									<div class="space-y-1 text-sm">
										<h4 class="font-medium">{user.name || user.email}</h4>
										{#each activities as { page, page_type_url, page_url, page_type, page_page_type, site_symbol }}
											<div class="flex items-center gap-1">
												{#if site_symbol}
													<Icon icon="lucide:cuboid" />
													<p>{site_symbol.name}</p>
												{:else if page && page_page_type}
													<Icon icon={page_page_type.icon} />
													<a href={page_url?.href} class="underline">{page.name}</a>
												{:else if page_type}
													<Icon icon={page_type.icon} />
													<a href={page_type_url?.href} class="underline">{page_type.name}</a>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							</Popover.Content>
						</Popover.Root>
					</div>
				{/each}
			</div>
			<!-- {#if !$timeline.first}
				<ToolbarButton id="undo" title="Undo" icon="material-symbols:undo" style="border: 0; font-size: 1.5rem;" on:click={undo_change} />
			{/if}
			{#if !$timeline.last}
				<ToolbarButton id="redo" title="Redo" icon="material-symbols:redo" style="border: 0; font-size: 1.5rem;" on:click={redo_change} />
			{/if} -->
			<div id="primo-dev-indicator-slot"></div>
			{#if $read_only}
				<BrowseModePill />
			{/if}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button {...props} class="more-menu-button" aria-label="More options">
							<Icon icon="mdi:dots-vertical" />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content side="bottom" class="z-[999]" align="end" sideOffset={4}>
					{#if !instance.dev_mode && $current_user?.serverRole}
						<DropdownMenu.Item onclick={() => (editing_collaborators = true)} class="text-xs cursor-pointer">
							<Icon icon="clarity:users-solid" style="width: .75rem" />
							<span>Collaborators</span>
						</DropdownMenu.Item>
					{/if}
					<DropdownMenu.Item
						onclick={async () => {
							self.instance?.authStore.clear()
							await goto('/admin/auth')
						}}
						class="text-xs cursor-pointer"
					>
						<Icon icon="mdi:logout" style="width: .75rem" />
						<span>Log out</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			{@render children?.()}
			<!-- <LocaleSelector /> -->
			{#if !$read_only}
				<ToolbarButton
					type="primo"
					icon={instance.dev_mode ? 'lucide:eye' : 'entypo:publish'}
					label={instance.dev_mode ? 'Preview' : 'Publish'}
					key="p"
					loading={publish_in_progress}
					on:click={() => (publishing = true)}
				/>
			{/if}
		</div>
	</div>
</nav>

<style lang="postcss">
	#primo-toolbar {
		z-index: 99;
		flex-shrink: 0;
		border-bottom: 1px solid #303034;
		background: #171719;
	}
	.menu-container {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1.5rem;
		min-height: 58px;
		padding: 10px 16px;
	}
	.left,
	.right,
	.button-group,
	.navigation-group {
		display: flex;
		align-items: center;
	}
	.left {
		flex-shrink: 0;
		gap: 8px;
	}
	.right {
		justify-content: flex-end;
		gap: 12px;
	}
	.navigation-group {
		height: 34px;
		border: 1px solid #36363a;
		border-radius: 7px;
		background: #202023;
	}
	.site-name {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		gap: 10px;
		font-size: 12px;
		.site,
		.page {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.site {
			color: #a5a5ad;
		}
		.separator {
			color: #64646d;
		}
		.page {
			color: #f4f4f5;
			font-weight: 500;
		}
		.page-type,
		.page-type-badge {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 5px;
			flex-shrink: 0;
			color: white;
			border-radius: 5px;
			padding: 5px;
		}
		.page-type {
			padding: 4px 8px;
		}
	}
	.more-menu-button {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #b8b8c0;
		border-radius: 6px;
		height: 32px;
		width: 32px;
		transition:
			background-color 0.15s,
			color 0.15s;
		&:hover {
			background: #303034;
			color: #fff;
		}
		&:focus-visible {
			outline: 2px solid #c4c4ce;
			outline-offset: 3px;
		}
	}
	.page-hotkeys {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 34px;
		padding: 0 10px;
		border: 1px solid #36363a;
		border-radius: 7px;
		color: #d4d4d8;
		font-size: 12px;
	}
	@media (max-width: 900px) {
		.menu-container {
			gap: 12px;
			padding-inline: 10px;
		}
		.site-name {
			max-width: 100%;
			gap: 6px;
		}
		.site-name .site,
		.site-name .separator {
			display: none;
		}
		.right {
			gap: 8px;
		}
	}
	@media (max-width: 760px) {
		.menu-container {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.site-name {
			display: none;
		}
		.left {
			gap: 5px;
		}
		.right {
			gap: 5px;
		}
	}
	@media (max-width: 480px) {
		.menu-container { gap: 6px; padding-inline: 6px; }
		.left :global(.primo-button .label),
		.right :global(.primo-button .label) { display: none; }
		.left :global(.primo-button),
		.right :global(.primo-button) { padding-inline: 8px; }
	}
</style>
