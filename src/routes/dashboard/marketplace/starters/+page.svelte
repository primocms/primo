<script>
	import * as Dialog from '$lib/components/ui/dialog'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import CreateStarter from '$lib/components/Modals/CreateStarter.svelte'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { CirclePlus, LayoutTemplate } from 'lucide-svelte'
	import MarketplaceStarterButton from '$lib/components/MarketplaceStarterButton.svelte'
	import * as actions from '$lib/actions'
	import { invalidate, goto } from '$app/navigation'

	/**
	 * @typedef {Object} Props
	 * @property {any} data
	 */

	/** @type {Props} */
	let { data } = $props()
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">Starters</div>
	</div>
</header>
<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if data.starters.length > 0}
		<div class="sites-container">
			<ul class="sites">
				{#each data.starters as site (site.id)}
					<li>
						<MarketplaceStarterButton site={site.data} preview={site.preview} />
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<EmptyState icon={LayoutTemplate} title="No Starters to display" description="Starters are starting points for your sites. When you create one it'll show up here." />
	{/if}
</div>

<style lang="postcss">
	.sites-container {
		display: grid;
		gap: 1rem;

		ul.sites {
			display: grid;
			gap: 1rem;
		}
	}

	@media (min-width: 600px) {
		ul.sites {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (min-width: 900px) {
		ul.sites {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}

	@media (min-width: 1200px) {
		ul.sites {
			grid-template-columns: 1fr 1fr 1fr 1fr;
		}
	}
</style>
