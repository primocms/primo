<script>
	import * as Dialog from '$lib/components/ui/dialog'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import CreateStarter from '$lib/components/Modals/CreateStarter.svelte'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { CirclePlus, LayoutTemplate } from 'lucide-svelte'
	import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
	import * as actions from '$lib/actions'
	import { invalidate, goto } from '$app/navigation'

	/**
	 * @typedef {Object} Props
	 * @property {any} data
	 */

	/** @type {Props} */
	let { data } = $props()

	async function create_starter({ details, site_data, preview }) {
		await actions.create_starter({ details, site_data, preview })
		invalidate('app:data')
		creating_starter = false
	}

	let creating_starter = $state(false)
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">Starters</div>
	</div>
	{#if !data.user.collaborator}
		<div class="ml-auto mr-4">
			<Button size="sm" variant="outline" onclick={() => (creating_starter = true)}>
				<CirclePlus class="h-4 w-4" />
				Create Starter
			</Button>
			<Dialog.Root bind:open={creating_starter}>
				<Dialog.Content class="flex flex-col p-4">
					<CreateStarter onclose={() => (creating_starter = false)} onsubmit={create_starter} />
				</Dialog.Content>
			</Dialog.Root>
		</div>
	{/if}
</header>
<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if data.starters.length > 0}
		<div class="sites-container">
			<ul class="sites">
				{#each data.starters as site (site.id)}
					<li>
						<SiteThumbnail {site} />
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
			row-gap: 1.5rem;
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
