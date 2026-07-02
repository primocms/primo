<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { Input } from '$lib/components/ui/input'
	import { Button } from '$lib/components/ui/button'
	import { Globe, Library, Store, ChevronsUpDown, LogOut, ChevronRight, Plus, LayoutTemplate, Cuboid } from 'lucide-svelte'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Collapsible from '$lib/components/ui/collapsible'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { useSidebar } from '$lib/components/ui/sidebar/index.js'
	import { marketplace, self } from '$lib/pocketbase/managers'
	import type { Component } from 'svelte'
	import { LibrarySymbolGroups, SiteGroups } from '$lib/pocketbase/collections'
	import { current_user } from '$lib/pocketbase/user'
	import { instance } from '$lib/instance'
	import { CreditCard } from 'lucide-svelte'

	const sidebar = useSidebar()

	interface MenuItem {
		title: string
		icon: Component
		url: string
	}

	interface MenuButton {
		title: string
		url: string
	}

	interface SidebarMenu {
		title: string
		items?: MenuItem[]
		buttons?: MenuButton[]
	}

	let { sidebar_menu = [] } = $props<{
		sidebar_menu?: SidebarMenu
	}>()

	let is_creating_site_group = $state(false)
	let new_site_group_name = $state('')
	async function create_site_group(e) {
		e.preventDefault()
		const userId = $current_user?.id
		if (!userId) return
		const newGroup = SiteGroups.create({ name: new_site_group_name, index: 0 })
		await self.commit()
		new_site_group_name = ''
		is_creating_site_group = false
		// Navigate to the newly created group
		goto(`/admin/dashboard/sites?group=${newGroup.id}`)
	}

	let is_creating_symbol_group = $state(false)
	let new_symbol_group_name = $state('')
	async function create_symbol_group(e) {
		e.preventDefault()
		const userId = $current_user?.id
		if (!userId) return
		const newGroup = LibrarySymbolGroups.create({ name: new_symbol_group_name, index: 0 })
		await self.commit()
		new_symbol_group_name = ''
		is_creating_symbol_group = false
		// Navigate to the newly created group
		goto(`/admin/dashboard/library?group=${newGroup.id}`)
	}

	function get_dashboard_url() {
		if (typeof window === 'undefined') return '/admin/dashboard'
		const { protocol, hostname, port } = window.location
		if (hostname === 'localhost' || hostname === '127.0.0.1') {
			return `${protocol}//${hostname}${port ? `:${port}` : ''}/`
		}
		if (hostname.endsWith('.localhost')) {
			return `${protocol}//localhost${port ? `:${port}` : ''}/`
		}
		return '/admin/dashboard'
	}

	const path = $derived($page.url.pathname.split('/').slice(0, 4).join('/'))
</script>

<Dialog.Root bind:open={is_creating_site_group}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">New Site Group</h2>
		<form onsubmit={create_site_group}>
			<Input bind:value={new_site_group_name} placeholder="Name your site group" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_creating_site_group = false)}>Cancel</Button>
				<Button type="submit">Create Group</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_creating_symbol_group}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Create Group</h2>
		<form onsubmit={create_symbol_group}>
			<Input bind:value={new_symbol_group_name} placeholder="Enter new Group name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_creating_symbol_group = false)}>Cancel</Button>
				<Button type="submit">Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Sidebar.Root collapsible="icon" class="overflow-hidden *:data-[sidebar=sidebar]:flex-row">
	<Sidebar.Root collapsible="none" class="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
		<!-- <Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton size="lg" class="md:h-8 md:p-0">
						{#snippet child({ props })}
							<a href="/" {...props}>
								<div class="bg-[var(--primo-primary-color)] text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">p</div>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Header> -->
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupContent class="px-1.5 md:px-0">
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={$page.url.pathname.startsWith('/admin/dashboard/sites')}
								tooltipContentProps={{
									hidden: false
								}}
								onclick={() => {
									window.location.href = get_dashboard_url()
									sidebar.setOpen(true)
								}}
								class="px-2.5 md:px-2"
							>
								{#snippet tooltipContent()}
									Sites
								{/snippet}
								<Globe />
								<span>Sites</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={$page.url.pathname.startsWith('/admin/dashboard/library')}
								tooltipContentProps={{
									hidden: false
								}}
								onclick={() => {
									goto('/admin/dashboard/library')
									sidebar.setOpen(true)
								}}
								class="px-2.5 md:px-2"
							>
								{#snippet tooltipContent()}
									Library
								{/snippet}
								<Library />
								<span>Library</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={$page.url.pathname.startsWith('/admin/dashboard/marketplace')}
								tooltipContentProps={{
									hidden: false
								}}
								onclick={() => {
									goto('/admin/dashboard/marketplace')
									sidebar.setOpen(true)
								}}
								class="px-2.5 md:px-2"
							>
								{#snippet tooltipContent()}
									Marketplace
								{/snippet}
								<Store />
								<span>Marketplace</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Sidebar.MenuButton {...props} size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground md:h-8 md:p-0">
									<Avatar.Root class="h-8 w-8 rounded-lg">
										{#if $current_user?.avatar}
											{@const user_avatar = `${self.instance?.baseURL}/api/files/collaborators/${$current_user.id}/${$current_user.avatar}`}
											<Avatar.Image src={user_avatar} alt={$current_user.name} />
										{/if}
										<Avatar.Fallback class="rounded-lg uppercase">{($current_user?.name || $current_user?.email || '').slice(0, 2).toUpperCase()}</Avatar.Fallback>
									</Avatar.Root>
									<div class="grid flex-1 text-left text-sm leading-tight">
										<span class="truncate font-semibold">{$current_user?.email}</span>
										<!-- <span class="truncate text-xs">{$current_user.email}</span> -->
									</div>
									<ChevronsUpDown class="ml-auto size-4" />
								</Sidebar.MenuButton>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg" side={sidebar.isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
							<DropdownMenu.Label class="p-0 font-normal">
								<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar.Root class="h-10 w-10 rounded-lg">
										{#if $current_user?.avatar}
											{@const user_avatar = `${self.instance?.baseURL}/api/files/collaborators/${$current_user.id}/${$current_user.avatar}`}
											<Avatar.Image src={user_avatar} alt={$current_user?.name} />
										{/if}
										<Avatar.Fallback class="rounded-lg uppercase">{($current_user?.name || $current_user?.email || '').slice(0, 2).toUpperCase()}</Avatar.Fallback>
									</Avatar.Root>
									<div class="grid flex-1 text-left text-sm leading-tight">
										{#if $current_user?.name}<span class="truncate font-semibold">{$current_user?.name}</span>{/if}
										<span class="truncate text-xs">{$current_user?.email}</span>
									</div>
								</div>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							{#if instance.hosted_mode && instance.billing_url}
								<DropdownMenu.Item onclick={() => window.open(instance.billing_url, '_blank')}>
									<CreditCard />
									Manage Subscription
								</DropdownMenu.Item>
								<DropdownMenu.Separator />
							{/if}
							<DropdownMenu.Item
								onclick={async () => {
									self.instance?.authStore.clear()
									await goto('/admin/auth')
								}}
							>
								<LogOut />
								Log out
							</DropdownMenu.Item>
							{#if instance.version}
								<DropdownMenu.Separator />
								<div class="px-2 py-1 text-[0.625rem] text-muted-foreground select-text">Primo {instance.version}</div>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>
	</Sidebar.Root>

	<Sidebar.Root collapsible="none" class="flex-1 flex">
		{#if path.startsWith('/admin/dashboard/sites')}
			<Sidebar.Header class="gap-3.5 border-b p-4">
				<div class="flex w-full text-foreground text-base font-medium gap-2">
					<Globe class="w-4" />
					<span>Sites</span>
				</div>
			</Sidebar.Header>
			<Sidebar.Content class="p-2">
				<Sidebar.Menu>
					{#each SiteGroups.list() ?? [] as group}
						{@const url = `/admin/dashboard/sites?group=${group.id}`}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={$page.url.pathname + $page.url.search === url}>
								{#snippet child({ props })}
									<a href={url} {...props}>
										<span>{group.name}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton class="text-sidebar-foreground/70">
							{#snippet child({ props })}
								<button {...props} onclick={() => (is_creating_site_group = true)}>
									<span>Create Group</span>
									<Plus />
								</button>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Content>
		{:else if path.startsWith('/admin/dashboard/library')}
			<Sidebar.Header class="gap-3.5 border-b p-4">
				<div class="flex w-full text-foreground text-base font-medium gap-2">
					<Library class="w-4" />
					<span>Block Library</span>
				</div>
			</Sidebar.Header>
			<Sidebar.Content class="p-2">
				<Sidebar.Menu>
					{#each LibrarySymbolGroups.list() ?? [] as group}
						{@const url = `/admin/dashboard/library?group=${group.id}`}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={$page.url.pathname + $page.url.search === url}>
								{#snippet child({ props })}
									<a href={url} {...props}>
										<span>{group.name}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton class="text-sidebar-foreground/70">
							{#snippet child({ props })}
								<button {...props} onclick={() => (is_creating_symbol_group = true)}>
									<span>Create Group</span>
									<Plus />
								</button>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Content>
		{:else if path.startsWith('/admin/dashboard/marketplace')}
			<Sidebar.Header class="gap-3.5 border-b p-4">
				<div class="flex w-full text-foreground text-base font-medium gap-2">
					<Store class="w-4" />
					<span>Marketplace</span>
				</div>
			</Sidebar.Header>
			<Sidebar.Content class="p-2">
				<Sidebar.Menu>
					<!-- Starters -->
					<Sidebar.MenuItem>
						<Collapsible.Root title="Starters" open={true} class="group/collapsible">
							<Sidebar.Group class="p-0">
								<Sidebar.GroupLabel class="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm">
									{#snippet child({ props })}
										<Collapsible.Trigger {...props}>
											<LayoutTemplate />
											<span class="pl-2">Starters</span>
											<ChevronRight class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
										</Collapsible.Trigger>
									{/snippet}
								</Sidebar.GroupLabel>
								<Collapsible.Content>
									<Sidebar.GroupContent>
										<Sidebar.Menu>
											{#each SiteGroups.from(marketplace).list({ sort: 'index' }) ?? [] as group}
												{@const url = `/admin/dashboard/marketplace/starters?group=${group.id}`}
												<Sidebar.MenuItem>
													<Sidebar.MenuButton isActive={$page.url.pathname + $page.url.search === url}>
														{#snippet child({ props })}
															<a href={url} {...props}>
																<span>{group.name}</span>
															</a>
														{/snippet}
													</Sidebar.MenuButton>
												</Sidebar.MenuItem>
											{/each}
										</Sidebar.Menu>
									</Sidebar.GroupContent>
								</Collapsible.Content>
							</Sidebar.Group>
						</Collapsible.Root>
					</Sidebar.MenuItem>
					<!-- Blocks -->
					<Sidebar.MenuItem>
						<Collapsible.Root title="Blocks" open={true} class="group/collapsible">
							<Sidebar.Group class="p-0">
								<Sidebar.GroupLabel class="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm">
									{#snippet child({ props })}
										<Collapsible.Trigger {...props}>
											<Cuboid />
											<span class="pl-2">Blocks</span>
											<ChevronRight class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
										</Collapsible.Trigger>
									{/snippet}
								</Sidebar.GroupLabel>
								<Collapsible.Content>
									<Sidebar.GroupContent>
										<Sidebar.Menu>
											{#each LibrarySymbolGroups.from(marketplace).list() ?? [] as group}
												{@const url = `/admin/dashboard/marketplace/blocks?group=${group.id}`}
												<Sidebar.MenuItem>
													<Sidebar.MenuButton isActive={$page.url.pathname + $page.url.search === url}>
														{#snippet child({ props })}
															<a href={url} {...props}>
																<span>{group.name}</span>
															</a>
														{/snippet}
													</Sidebar.MenuButton>
												</Sidebar.MenuItem>
											{/each}
										</Sidebar.Menu>
									</Sidebar.GroupContent>
								</Collapsible.Content>
							</Sidebar.Group>
						</Collapsible.Root>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Content>
		{/if}
	</Sidebar.Root>
</Sidebar.Root>
