<script lang="ts">
	import * as actions from '$lib/actions'
	import { create_library_symbol_group } from '$lib/actions'
	import * as Dialog from '$lib/components/ui/dialog'
	import { goto, invalidate } from '$app/navigation'
	import { page } from '$app/stores'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { Input } from '$lib/components/ui/input'
	import { Button, buttonVariants } from '$lib/components/ui/button'
	import { Globe, Library, Store, ChevronsUpDown, LogOut, BookText, ChevronRight, Plus, LayoutTemplate, Cuboid, Ellipsis, Trash2, SquarePen } from 'lucide-svelte'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Collapsible from '$lib/components/ui/collapsible'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { useSidebar } from '$lib/components/ui/sidebar/index.js'

	const sidebar = useSidebar()

	interface MenuItem {
		title: string
		icon: ComponentType<SvelteComponent>
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
		await actions.create_site_group(new_site_group_name)
		invalidate('app:data')
		is_creating_site_group = false
	}

	let is_dialog_open = $state(false)
	let new_group_name = $state('')
	async function create_group(e) {
		e.preventDefault()
		await create_library_symbol_group(new_group_name)
		invalidate('app:data')
		is_dialog_open = false
	}

	const path = $derived($page.url.pathname.split('/').slice(0, 3).join('/'))
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

<Dialog.Root bind:open={is_dialog_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Create Group</h2>
		<form onsubmit={create_group}>
			<Input bind:value={new_group_name} placeholder="Enter new Group name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_dialog_open = false)}>Cancel</Button>
				<Button type="submit">Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Sidebar.Root collapsible="icon" class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row">
	<Sidebar.Root collapsible="none" class="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r">
		<Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton size="lg" class="md:h-8 md:p-0">
						{#snippet child({ props })}
							<a href="##" {...props}>
								<div class="bg-[var(--weave-primary-color)] text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">w</div>
								<!-- <div class="grid flex-1 text-left text-sm leading-tight">
									<span class="truncate font-semibold">Acme Inc</span>
									<span class="truncate text-xs">Enterprise</span>
								</div> -->
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupContent class="px-1.5 md:px-0">
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={$page.url.pathname.startsWith('/dashboard/sites')}
								tooltipContentProps={{
									hidden: false
								}}
								onclick={() => {
									goto('/dashboard')
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
								isActive={$page.url.pathname.startsWith('/dashboard/library')}
								tooltipContentProps={{
									hidden: false
								}}
								onclick={() => {
									goto('/dashboard/library')
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
								isActive={$page.url.pathname.startsWith('/dashboard/marketplace')}
								tooltipContentProps={{
									hidden: false
								}}
								onclick={() => {
									goto('/dashboard/marketplace')
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
										<!-- <Avatar.Image src={user.avatar} alt={user.name} /> -->
										<Avatar.Fallback class="rounded-lg uppercase">{$page.data.user.email.slice(0, 2)}</Avatar.Fallback>
									</Avatar.Root>
									<div class="grid flex-1 text-left text-sm leading-tight">
										<span class="truncate font-semibold">{$page.data.user.email}</span>
										<!-- <span class="truncate text-xs">{user.email}</span> -->
									</div>
									<ChevronsUpDown class="ml-auto size-4" />
								</Sidebar.MenuButton>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="w-[--bits-dropdown-menu-anchor-width] min-w-56 rounded-lg" side={sidebar.isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
							<DropdownMenu.Label class="p-0 font-normal">
								<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar.Root class="h-8 w-8 rounded-lg">
										<!-- <Avatar.Image src={user.avatar} alt={user.name} /> -->
										<Avatar.Fallback class="rounded-lg uppercase">{$page.data.user.email.slice(0, 2)}</Avatar.Fallback>
									</Avatar.Root>
									<div class="grid flex-1 text-left text-sm leading-tight">
										<span class="truncate font-semibold">{$page.data.user.email}</span>
										<!-- <span class="truncate text-xs">{user.email}</span> -->
									</div>
								</div>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								onclick={async () => {
									await $page.data.supabase.auth.signOut()
									window.location.reload()
								}}
							>
								<LogOut />
								Log out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>
	</Sidebar.Root>

	<Sidebar.Root collapsible="none" class="flex-1 flex">
		{#if path.startsWith('/dashboard/sites')}
			<Sidebar.Header class="gap-3.5 border-b p-4">
				<div class="flex w-full text-foreground text-base font-medium gap-2">
					<Globe class="w-4" />
					<span>Sites</span>
				</div>
			</Sidebar.Header>
			<Sidebar.Content class="p-2">
				<Sidebar.Menu>
					{#each sidebar_menu.site_groups as group}
						{@const url = `/dashboard/sites?group=${group.id}`}
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
		{:else if path.startsWith('/dashboard/library')}
			<Sidebar.Header class="gap-3.5 border-b p-4">
				<div class="flex w-full text-foreground text-base font-medium gap-2">
					<Library class="w-4" />
					<span>Library</span>
				</div>
			</Sidebar.Header>
			<Sidebar.Content class="p-2">
				<Sidebar.Menu>
					<!-- Starters -->
					<Sidebar.MenuItem>
						<Sidebar.MenuButton class="font-medium" isActive={$page.url.pathname === '/dashboard/library/starters'}>
							{#snippet child({ props })}
								<a href="/dashboard/library/starters" {...props}>
									<LayoutTemplate />
									<span>Starters</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
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
											{#each $page.data.symbol_groups as group}
												{@const url = `/dashboard/library/blocks?group=${group.id}`}
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
														<button {...props} onclick={() => (is_dialog_open = true)}>
															<span>Create Group</span>
															<Plus />
														</button>
													{/snippet}
												</Sidebar.MenuButton>
											</Sidebar.MenuItem>
										</Sidebar.Menu>
									</Sidebar.GroupContent>
								</Collapsible.Content>
							</Sidebar.Group>
						</Collapsible.Root>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Content>
		{:else if path.startsWith('/dashboard/marketplace')}
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
						<Sidebar.MenuButton class="font-medium" isActive={$page.url.pathname === '/dashboard/marketplace/starters'}>
							{#snippet child({ props })}
								<a href="/dashboard/marketplace/starters" {...props}>
									<LayoutTemplate />
									<span>Starters</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
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
											{#each $page.data.marketplace_symbol_groups as group}
												{@const url = `/dashboard/marketplace/blocks?group=${group.id}`}
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
