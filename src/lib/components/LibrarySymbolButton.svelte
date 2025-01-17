<script>
	import CreateBlock from '$lib/components/modals/CreateBlock.svelte'
	import fileSaver from 'file-saver'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import { EllipsisVertical, SquarePen, Trash2, Download, Code, Loader } from 'lucide-svelte'
	import { find as _find } from 'lodash-es'
	import { supabase } from '$lib/supabase'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { Button, buttonVariants } from '$lib/components/ui/button'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import * as actions from '$lib/actions'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'
	import { invalidate } from '$app/navigation'

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Symbol} symbol
	 * @property {string} [head]
	 */

	/** @type {Props} */
	let { symbol, head = '' } = $props()

	let preview = $state('')
	get_preview()
	async function get_preview() {
		const { data } = await supabase.storage.from('symbols').download(`${symbol.id}/preview.html`)
		if (!data) {
			console.error('Could not download symbol html')
			return
		}
		const html = await data?.text()
		preview = html
	}

	let is_editor_open = $state(false)
	let is_rename_open = $state(false)
	let is_delete_open = $state(false)
	let new_name = $state(symbol.name)

	async function handle_rename() {
		await actions.rename_library_symbol(symbol.id, new_name)
		invalidate('app:data')
		is_rename_open = false
	}

	async function save_symbol(updated) {
		await actions.save_library_symbol(symbol.id, updated)
		get_preview()
		is_editor_open = false
	}

	let deleting = $state(false)
	async function delete_library_symbol() {
		is_delete_open = false
		await actions.delete_library_symbol(symbol.id)
		invalidate('app:data')
	}
</script>

<div class="space-y-3 relative w-full bg-gray-900">
	<button onclick={() => (is_editor_open = true)} class="w-full rounded-tl rounded-tr overflow-hidden h-[10rem] aspect-[1.5]">
		<SitePreview {preview} {head} />
	</button>
	<div class="absolute -bottom-2 rounded-bl rounded-br w-full p-3 z-20 bg-gray-900 truncate flex items-center justify-between">
		<div class="text-sm font-medium leading-none">{symbol.name}</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<EllipsisVertical size={14} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Item onclick={() => (is_editor_open = true)}>
					<Code class="h-4 w-4" />
					<span>Edit</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => (is_rename_open = true)}>
					<SquarePen class="h-4 w-4" />
					<span>Rename</span>
				</DropdownMenu.Item>
				<!-- <DropdownMenu.Item onclick={download_site_file}>
					<Download class="h-4 w-4" />
					<span>Download</span>
				</DropdownMenu.Item> -->
				<DropdownMenu.Item onclick={() => (is_delete_open = true)} class="text-red-500 hover:text-red-600 focus:text-red-600">
					<Trash2 class="h-4 w-4" />
					<span>Delete</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>

<Dialog.Root bind:open={is_editor_open}>
	<Dialog.Content class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4 gap-0">
		<CreateBlock {symbol} {head} onsubmit={save_symbol} />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_rename_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename Block</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your Block</p>
		<form onsubmit={handle_rename}>
			<Input bind:value={new_name} placeholder="Enter new Block name" class="my-4" />
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
				This action cannot be undone. This will permanently delete <strong>{symbol.name}</strong>
				and remove all associated data.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={delete_library_symbol} class="bg-red-600 hover:bg-red-700">
				{#if deleting}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {symbol.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
