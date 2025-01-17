<script>
	import * as Dialog from '$lib/components/ui/dialog'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import Icon from '@iconify/svelte/dist/Icon.svelte'
	import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import * as actions from '$lib/actions'
	import { invalidate, goto } from '$app/navigation'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import { CirclePlus, Globe } from 'lucide-svelte'
	import CreateSite from '$lib/components/CreateSite.svelte'

	/**
	 * @typedef {Object} Props
	 * @property {any} data
	 */

	/** @type {Props} */
	let { data } = $props()

	async function create_site({ starter_id, details, starter_data, preview }) {
		await actions.sites.create({ starter_id, details, starter_data, preview })
		invalidate('app:data')
		creating_site = false
	}

	// async function delete_site(siteID) {
	// 	const confirm = window.confirm(`Are you sure you want to delete this site? You won't be able to get it back.`)
	// 	if (!confirm) return
	// 	await actions.sites.delete(siteID)
	// 	invalidate('app:data')
	// }

	let creating_site = $state(false)
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">All Sites</div>
	</div>
	{#if !data.user.collaborator}
		<div class="ml-auto mr-4">
			<Button size="sm" variant="outline" onclick={() => (creating_site = true)}>
				<CirclePlus class="h-4 w-4" />
				Create Site
			</Button>
			<Dialog.Root bind:open={creating_site}>
				<Dialog.Content class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4">
					<CreateSite onclose={() => (creating_site = false)} onsubmit={create_site} />
				</Dialog.Content>
			</Dialog.Root>
		</div>
	{/if}
</header>
<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if data.sites.length > 0}
		<div class="sites-container">
			<ul class="sites">
				{#each data.sites as site (site.id)}
					<li>
						<SiteThumbnail {site} />
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<EmptyState icon={Globe} title="No Sites to display" description="It looks like you haven't created any websites yet." />
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
