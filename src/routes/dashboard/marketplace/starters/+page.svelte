<script lang="ts">
	import MarketplaceTabs from '$lib/components/MarketplaceTabs.svelte'
	import { rememberMarketplaceScroll } from '$lib/components/marketplace-navigation.svelte'

	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Separator } from '$lib/components/ui/separator'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { LayoutTemplate, Info, Globe, ExternalLink, SquarePen, CheckCircle } from 'lucide-svelte'
	import MarketplaceStarterButton from '$lib/components/MarketplaceStarterButton.svelte'
	import { Button } from '$lib/components/ui/button'
	import { page } from '$app/state'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { goto } from '$app/navigation'
	import { marketplace } from '$lib/pocketbase/managers'
	import { SiteGroups, Sites } from '$lib/pocketbase/collections'

	const group_id = $derived(page.url.searchParams.get('group') ?? undefined)
	const starters = $derived(group_id ? (Sites.from(marketplace).list({ filter: { group: group_id }, sort: 'index' }) ?? undefined) : undefined)

	let is_info_dialog_open = $state(false)

	// Auto-select first group if none is selected
	$effect(() => {
		const groups = SiteGroups.from(marketplace).list({ sort: 'index' }) ?? []
		if (!group_id && groups.length > 0) {
			const url = new URL(page.url)
			url.searchParams.set('group', groups[0].id)
			goto(url, { replaceState: true })
		}
	})
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<MarketplaceTabs />
	</div>
	<div class="ml-auto mr-4">
		<Button size="sm" variant="outline" aria-label="How to Use Starters" onclick={() => (is_info_dialog_open = true)}>
			<Info class="h-4 w-4" />
			<span class="hidden sm:inline">How to Use Starters</span>
		</Button>
	</div>
</header>
<div use:rememberMarketplaceScroll={page.url.pathname + page.url.search} class="marketplace-content flex flex-1 flex-col gap-4">
	{#key group_id}
		{#if starters?.length || starters === undefined}
			<div class="starter-grid">
				{#if starters === undefined}
					{#each Array.from({ length: 8 }) as _}
						<Skeleton class="aspect-square w-full rounded-lg" />
					{/each}
				{:else}
					{#each starters as site (site.id)}
						<MarketplaceStarterButton {site} />
					{/each}
				{/if}
			</div>
		{:else}
			<EmptyState class="h-[50vh]" icon={LayoutTemplate} title="No Starters to display" description="Starters are starting points for your sites. When you create one it'll show up here." />
		{/if}
	{/key}
</div>

<Dialog.Root bind:open={is_info_dialog_open}>
	<Dialog.Content class="sm:max-w-[525px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">How to Use Starter Sites</h2>
		<p class="text-muted-foreground text-sm mb-6">Follow these steps to create a new site using a starter:</p>

		<div class="space-y-4">
			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<Globe class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Connect a new domain name to the server</h3>
					<p class="text-muted-foreground text-sm">Point your domain's DNS records to this server or configure your hosting provider to route traffic here.</p>
				</div>
			</div>

			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<ExternalLink class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Access the server from that domain name</h3>
					<p class="text-muted-foreground text-sm">Once the domain is connected, visit your new domain in a web browser. You'll be prompted to create a new site automatically.</p>
				</div>
			</div>

			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<LayoutTemplate class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Choose a starter site</h3>
					<p class="text-muted-foreground text-sm">
						During the site creation process, you can select one of these starter sites as a starting point for your new site. The starter will be cloned and customized for your domain.
					</p>
				</div>
			</div>

			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<SquarePen class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Customize your site</h3>
					<p class="text-muted-foreground text-sm">After creation, you can edit the content, design, and functionality of your site using the built-in editor.</p>
				</div>
			</div>
		</div>

		<Dialog.Footer class="mt-6">
			<Button type="button" onclick={() => (is_info_dialog_open = false)}>Got it</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style lang="postcss">
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
	.starter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
		gap: 20px;
		align-items: start;
	}
	@media (max-width: 700px) {
		.starter-grid {
			gap: 16px;
		}
	}
</style>
