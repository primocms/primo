<script lang="ts">
	import { page } from '$app/stores'
	import { LayoutTemplate, Cuboid, Store } from 'lucide-svelte'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { useSidebar } from '$lib/components/ui/sidebar/index.js'
</script>

<Sidebar.Root collapsible="none" class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row h-screen">
	<Sidebar.Header class="gap-3.5 border-b p-4">
		<div class="flex w-full text-foreground text-base font-medium gap-2">
			<Store />
			<span>Marketplace Admin</span>
		</div>
	</Sidebar.Header>
	<Sidebar.Content class="p-2">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton isActive={$page.url.pathname === '/dashboard/starters'}>
					{#snippet child({ props })}
						<a href="/dashboard/starters" {...props}>
							<LayoutTemplate />
							<span>Starters</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton isActive={$page.url.pathname === '/dashboard/blocks'}>
					{#snippet child({ props })}
						<a href="/dashboard/blocks" {...props}>
							<Cuboid />
							<span>Blocks</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Content>
	<Sidebar.Footer></Sidebar.Footer>
</Sidebar.Root>
