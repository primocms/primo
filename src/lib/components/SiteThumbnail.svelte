<script>
	import fileSaver from 'file-saver'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import { EllipsisVertical, SquarePen, Trash2, Download, Loader, ArrowLeftRight } from 'lucide-svelte'
	import { find as _find } from 'lodash-es'
	import { supabase } from '$lib/supabase'
	import { page } from '$app/stores'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { Label } from '$lib/components/ui/label'
	import { Button, buttonVariants } from '$lib/components/ui/button'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import { fetch_site_data, sites } from '$lib/actions'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'
	import { invalidate } from '$app/navigation'
	import * as actions from '$lib/actions'

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Site} site
	 * @property {any} [preview]
	 * @property {string} [append]
	 * @property {string} [style]
	 * @property {any} [src]
	 */

	/** @type {Props} */
	let { site, preview = $bindable(null), append = '', style = '', src = null } = $props()

	if (!preview && site) {
		get_preview()
	}

	async function get_preview() {
		const { data } = await supabase.storage.from('sites').download(`${site.id}/preview.html`)
		const html = await data?.text()
		preview = html
	}

	async function download_site_file() {
		const site_data = await fetch_site_data(site.id)
		const json = JSON.stringify({ ...site_data, version: 3 })
		var blob = new Blob([json], { type: 'application/json' })
		fileSaver.saveAs(blob, `${site.name || site.id}.json`)
	}

	let container = $state()
	let scale = $state()
	let iframeHeight = $state()
	let iframe = $state()

	function resizePreview() {
		const { clientWidth: parentWidth } = container
		const { clientWidth: childWidth } = iframe
		scale = parentWidth / childWidth
		iframeHeight = `${100 / scale}%`
	}

	function append_to_iframe(code) {
		var container = document.createElement('div')

		// Set the innerHTML of the container to your HTML string
		container.innerHTML = code

		// Append each element in the container to the document head
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.body.appendChild(node)
		})
	}

	// wait for processor to load before building preview
	let processorLoaded = false
	setTimeout(() => {
		processorLoaded = true
	}, 500)
	$effect(() => {
		iframe && append_to_iframe(append)
	})

	let is_rename_open = $state(false)
	let is_delete_open = $state(false)
	let new_name = $state(site.name)

	async function handle_rename() {
		is_rename_open = false
		await actions.sites.update(site.id, { name: new_name })
		invalidate('app:data')
	}

	let deleting = $state(false)
	async function delete_site() {
		is_delete_open = false
		await sites.delete(site.id)
		invalidate('app:data')
	}

	let is_move_open = $state(false)
	let selected_group_id = $state(site.group)
	async function move_site() {
		is_move_open = false
		await actions.sites.move(site.id, selected_group_id)
		invalidate('app:data')
	}
</script>

<svelte:window onresize={resizePreview} />

<Dialog.Root bind:open={is_move_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="font-medium leading-none">Move to group</h4>
				<p class="text-muted-foreground text-sm">Select a group for this site</p>
			</div>
			<RadioGroup.Root bind:value={selected_group_id}>
				{#each $page.data.site_groups as group}
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value={group.id} id={group.id} />
						<Label for={group.id}>{group.name}</Label>
					</div>
				{/each}
			</RadioGroup.Root>
			<div class="flex justify-end">
				<Button onclick={move_site}>Move</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<div class="space-y-3 relative w-full bg-gray-900">
	<div class="rounded-tl rounded-tr overflow-hidden">
		<a data-sveltekit-prefetch href="/{site.id}">
			<SitePreview {preview} {append} />
		</a>
	</div>
	<div class="absolute -bottom-2 rounded-bl rounded-br w-full p-3 z-20 bg-gray-900 truncate flex items-center justify-between">
		<a data-sveltekit-prefetch href="/{site.id}" class="text-sm font-medium leading-none hover:underline">{site.name}</a>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<EllipsisVertical size={14} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Item onclick={() => (is_rename_open = true)}>
					<SquarePen class="h-4 w-4" />
					<span>Rename</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => (is_move_open = true)}>
					<ArrowLeftRight class="h-4 w-4" />
					<span>Move</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={download_site_file}>
					<Download class="h-4 w-4" />
					<span>Download</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => (is_delete_open = true)} class="text-red-500 hover:text-red-600 focus:text-red-600">
					<Trash2 class="h-4 w-4" />
					<span>Delete</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>

<Dialog.Root bind:open={is_rename_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename Site</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your site</p>
		<form onsubmit={handle_rename}>
			<Input bind:value={new_name} placeholder="Enter new site name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_rename_open = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={is_delete_open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete <strong>{site.name}</strong>
				and remove all associated data.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={delete_site} class="bg-red-600 hover:bg-red-700">
				{#if deleting}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {site.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
