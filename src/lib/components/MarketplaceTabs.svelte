<script lang="ts">
	import { page } from '$app/state'
	import { browser } from '$app/environment'
	import { LayoutTemplate, Cuboid } from 'lucide-svelte'
	import { marketplaceNavigation } from './marketplace-navigation.svelte'

	const active = $derived(page.url.pathname.endsWith('/blocks') ? 'blocks' : 'starters')
	$effect(() => {
		if (browser) marketplaceNavigation[active] = page.url.search
	})
</script>

<nav class="marketplace-tabs" aria-label="Marketplace">
	{#each ['starters', 'blocks'] as tab}
		<a href={`/admin/dashboard/marketplace/${tab}${marketplaceNavigation[tab]}`} aria-current={active === tab ? 'page' : undefined}>
			{#if tab === 'starters'}<LayoutTemplate size={14} />{:else}<Cuboid size={14} />{/if}
			{tab === 'starters' ? 'Starters' : 'Blocks'}
		</a>
	{/each}
</nav>

<style lang="postcss">
	.marketplace-tabs {
		display: flex;
		gap: 3px;
		padding: 3px;
		border: 1px solid #36363a;
		border-radius: 8px;
		background: #202023;
	}
	a {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 6px 12px;
		border-radius: 5px;
		color: #a5a5ad;
		font-size: 12px;
		font-weight: 500;
		line-height: 18px;
	}
	a:hover {
		color: #f4f4f5;
		background: #303034;
	}
	a[aria-current='page'] {
		color: #f4f4f5;
		background: #39393f;
		box-shadow: 0 1px 3px #0003;
	}
	a:focus-visible {
		outline: 2px solid #c4c4ce;
		outline-offset: 2px;
	}
	@media (max-width: 500px) {
		a {
			padding-inline: 8px;
		}
	}
</style>
