<script>
	import * as Sidebar from '$lib/components/ui/sidebar'
	import AppSidebar from '$lib/components/app-sidebar.svelte'
	import { Globe, LayoutTemplate, Store, Library, Cuboid } from 'lucide-svelte'
	import { page } from '$app/state'
	import { check_session } from '$lib/pocketbase/user'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { current_user, set_current_user } from '$lib/pocketbase/user'

	onMount(async () => {
		if (!(await check_session())) {
			await goto('/admin/auth')
		}
	})

	let { children } = $props()

	const sidebar_menu = $derived.by(() => {
		const pathname = page.url.pathname
		const path = pathname.split('/').slice(0, 4).join('/')
		return {
			'/admin/dashboard/sites': {
				title: 'Sites',
				icon: Globe
			},
			'/admin/dashboard/library': {
				title: 'Block Library',
				icon: Library
			},
			'/admin/dashboard/marketplace': {
				title: 'Marketplace',
				icon: Store,
				buttons: [
					{
						icon: LayoutTemplate,
						label: 'Starters',
						url: '/admin/dashboard/marketplace/starters',
						isActive: pathname === '/admin/dashboard/marketplace/starters'
					},
					{
						icon: Cuboid,
						label: 'Blocks',
						url: '/admin/dashboard/marketplace/blocks',
						isActive: pathname === '/admin/dashboard/marketplace/blocks'
					}
				]
			}
		}[path]
	})

	$effect(() => set_current_user())
</script>

{#if !$current_user?.serverRole}
	<div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white;">Forbidden</div>
{:else}
	<Sidebar.Provider class="dashboard-shell">
		<AppSidebar {sidebar_menu} />
		<Sidebar.Inset class="dashboard-content">
			{@render children?.()}
		</Sidebar.Inset>
	</Sidebar.Provider>
{/if}

<style lang="postcss">
	:global(.dashboard-shell) {
		--background: 240 5% 12%;
		--sidebar-background: 240 4% 9%;
		--sidebar-accent: 240 4% 19%;
		--sidebar-border: 240 4% 20%;
		--sidebar-foreground: 240 7% 85%;
		--border: 240 4% 20%;
		--ring: 240 10% 80%;
		background: #171719;
	}
	:global(.dashboard-content) {
		min-width: 0;
		background: #1e1e21;
	}
	:global(.dashboard-content > header) {
		min-height: 58px;
		background: #171719;
		border-bottom: 1px solid #303034;
		margin-bottom: 20px;
	}
	:global(.dashboard-shell [data-sidebar='header']) {
		min-height: 58px;
		justify-content: center;
	}
	:global(.dashboard-shell [data-sidebar='menu-button']) {
		border-radius: 7px;
		font-size: 12px;
		min-height: 34px;
	}
	:global(.dashboard-shell [data-sidebar='menu-button'][data-active='true']) {
		background: #303034;
		color: #f4f4f5;
		box-shadow: inset 0 0 0 1px #ffffff08;
	}
	:global(.dashboard-shell [data-sidebar='menu-button']:focus-visible) {
		outline: 2px solid #c4c4ce;
		outline-offset: 2px;
	}
</style>
