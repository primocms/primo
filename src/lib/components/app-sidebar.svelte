<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { Globe, Library, Store, ChevronsUpDown, LogOut } from 'lucide-svelte'
	import * as Sidebar from '$lib/components/ui/sidebar'
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
</script>

<Sidebar.Root collapsible="icon" class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row">
	<Sidebar.Root collapsible="none" class="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r">
		<Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton size="lg" class="md:h-8 md:p-0">
						{#snippet child({ props })}
							<a href="##" {...props}>
								<div class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">p</div>
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

	<Sidebar.Root collapsible="none" class="hidden flex-1 md:flex">
		<Sidebar.Header class="gap-3.5 border-b p-4">
			<div class="flex w-full text-foreground text-base font-medium gap-2">
				<svelte:component this={sidebar_menu.icon} class="w-4" />
				<span>{sidebar_menu.title}</span>
			</div>
		</Sidebar.Header>
		<Sidebar.Content class="p-2">
			<Sidebar.Menu>
				{#each sidebar_menu.buttons as button}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={button.isActive}>
							{#snippet child({ props })}
								<a href={button.url} {...props}>
									<svelte:component this={button.icon} />
									<span>{button.label}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
				{#each sidebar_menu.items as item}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={item.isActive}>
							{#snippet child({ props })}
								<a href={item.url} {...props}>
									<span>{item.title}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Content>
		<Sidebar.Footer></Sidebar.Footer>
	</Sidebar.Root>
</Sidebar.Root>
