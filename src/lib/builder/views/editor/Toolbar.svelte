<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { fade } from 'svelte/transition'
	import { find as _find } from 'lodash-es'
	import Icon from '@iconify/svelte'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { ChevronDown } from 'lucide-svelte'
	import ToolbarButton from './ToolbarButton.svelte'
	import { PrimoButton } from '$lib/builder/components/buttons'
	import { mod_key_held } from '$lib/builder/stores/app/misc'
	import { onNavigate, goto } from '$app/navigation'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { page, page as pageState } from '$app/state'
	import { PageTypes, SiteSnapshots } from '$lib/pocketbase/collections'
	import { onModKey } from '$lib/builder/utils/keyboard'
	import * as Popover from '$lib/components/ui/popover/index.js'
	import SiteEditor from '$lib/builder/views/modal/SiteEditor/SiteEditor.svelte'
	import SitePages from '$lib/builder/views/modal/SitePages/SitePages.svelte'
	import PageTypeModal from '$lib/builder/views/modal/PageTypeModal/PageTypeModal.svelte'
	import Collaboration from '$lib/builder/views/modal/Collaboration.svelte'
	import Deploy from '$lib/components/Modals/Deploy/Deploy.svelte'
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

	let { children }: { children: Snippet } = $props()

	const { value: site } = site_context.get()
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
	async function handle_publish() {
		publish_in_progress = true
		try {
			await publish.run()

			// Create new snapshot and remove all other ones
			// TODO: The amount of snapshots could be larger once make UI for managing and restoring them
			const snapshots_to_remove = [...(existing_snapshots ?? [])]
			const snapshot = await create_snapshot.run()
			SiteSnapshots.create({
				site: site.id,
				file: Snapshot.encode(snapshot)
			})
			for (const existing_snapshot of snapshots_to_remove) {
				SiteSnapshots.delete(existing_snapshot.id)
			}
			await self.commit()
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

	let page_dropdown_anchor = $state<HTMLElement>(null!)

	let editing_site = $state(false)
	let site_has_unsaved_changes = $state(false)
	let editing_pages = $state(false)
	let editing_page_types = $state(false)
	let editing_collaborators = $state(false)
	let publishing = $state(false)
	let publish_stage = $state('INITIAL')

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
	<Dialog.Content class="z-999 max-w-[900px] h-[calc(100vh-1rem)] max-h-none flex flex-col p-4">
		<SitePages />
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
	<Dialog.Content class="z-[999] max-w-[500px] flex flex-col p-0">
		<Deploy
			bind:stage={publish_stage}
			publish_fn={handle_publish}
			loading={publish_in_progress}
			site_host={site?.host}
			onClose={() => {
				publishing = false
				publish_stage = 'INITIAL'
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<nav aria-label="toolbar" id="primo-toolbar">
	<div class="menu-container">
		<div class="left">
			{#if $current_user?.serverRole}
				<PrimoButton />
			{/if}
			<div class="button-group">
				<div class="flex rounded" style="border: 1px solid #222">
					<!-- <ToolbarButton label="Site" icon="gg:website" on:click={() => modal.show('SITE_EDITOR', {}, { showSwitch: true, disabledBgClose: true })} /> -->
					<ToolbarButton label="Site" icon="gg:website" on:click={() => (editing_site = true)} />
				</div>
			</div>
			<div class="button-group">
				{#if $mod_key_held}
					<div class="page-hotkeys">
						<div style:color={going_up ? 'var(--primo-primary-color)' : 'inherit'} style:opacity={can_navigate_up ? 1 : 0.3}>&#8984; ↑</div>
						<div style:color={going_down ? 'var(--primo-primary-color)' : 'inherit'} style:opacity={can_navigate_down ? 1 : 0.3}>&#8984; ↓</div>
					</div>
				{:else}
					<div class="flex rounded" style="border: 1px solid #222" bind:this={page_dropdown_anchor}>
						<ToolbarButton label="Pages" icon="iconoir:multiple-pages" on:click={() => (editing_pages = true)} />
						{#if $current_user?.siteRole === 'developer' || $current_user?.serverRole === 'developer'}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button {...props} class="hover:bg-[var(--primo-color-codeblack)]" style="border-left: 1px solid #222">
											<ChevronDown class="h-4" />
											<span class="sr-only">More</span>
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content side="bottom" class="z-[999]" align="start" sideOffset={4} customAnchor={page_dropdown_anchor}>
									<DropdownMenu.Item onclick={() => (editing_page_types = true)} class="text-xs cursor-pointer">
										<Icon icon="lucide:layout-template" style="width: .75rem" />
										<span>Page Types</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						{/if}
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
			<span class="version-badge">{instance.version}</span>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button {...props} class="more-menu-button">
							<Icon icon="mdi:dots-vertical" />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content side="bottom" class="z-[999]" align="end" sideOffset={4}>
					{#if instance.hosted_mode && $current_user?.serverRole}
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
			<ToolbarButton type="primo" icon={instance.dev_mode ? 'lucide:eye' : 'entypo:publish'} label={instance.dev_mode ? 'Preview' : 'Publish'} key="p" loading={publish_in_progress} on:click={() => (publishing = true)} />
		</div>
	</div>
</nav>

<style lang="postcss">
	#primo-toolbar {
		z-index: 99;
		border-bottom: 1px solid var(--color-gray-8);
	}

	.left {
		/* width: 100%; */
		display: flex;
		justify-content: flex-start;
		gap: 0.25rem;
	}

	.dropdown {
		display: flex;
		position: relative;
	}

	.left .button-group {
		display: flex;
		flex-direction: row;
	}

	.site-name {
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		place-content: center;

		.site {
			color: #b6b6b6;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.separator {
			color: #b6b6b6;
			margin: 0 0.25rem;
		}
		.page {
			color: white;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.page-type {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			color: white;
			border-radius: 1rem;
			padding: 2px 6px;
		}
		.page-type-badge {
			padding: 5px;
			border-radius: 1rem;
			aspect-ratio: 1;
			font-size: 0.75rem;
			display: flex;
			justify-content: center;
			align-items: center;
			color: white;
			margin-left: 0.25rem;
		}

		@media (max-width: 670px) {
			display: none;
		}
	}

	.menu-container {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		margin: 0 auto;
		/* background: #121212; */
		/* background: var(--color-gray-9); */
		padding: 6px 0.5rem;
		/* position: fixed;
		left: 0;
		right: 0;
		top: 0;
		z-index: 9999; */
		backdrop-filter: blur(4px);
		background: rgba(10, 10, 10, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);

		@media (max-width: 670px) {
			grid-template-columns: 1fr 1fr;
		}
	}

	.right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		place-content: flex-end;
	}

	.more-menu-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: var(--primo-border-radius);
		/* color: #888; */
		transition:
			color 0.15s,
			background-color 0.15s;

		&:hover {
			/* color: white; */
			background-color: var(--primo-color-codeblack);
		}
	}

	.button-group {
		height: 100%;
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
	}

	.page-hotkeys {
		font-size: 0.75rem;
		padding-inline: 9px;
		display: flex;
		gap: 4px;
		justify-content: space-around;
		border: 1px solid var(--color-gray-8);
		color: white;
		height: 100%;
		align-items: center;
		border-radius: var(--primo-border-radius);
	}

	.version-badge {
		font-size: 0.625rem;
		color: #555;
	}
</style>
