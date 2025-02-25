<script>
	import CreateBlock from '$lib/components/Modals/CreateBlock.svelte'
	import { EllipsisVertical, SquarePen, Trash2, ArrowLeftRight, Code, Loader } from 'lucide-svelte'
	import { find as _find } from 'lodash-es'
	import IFrame from '$lib/builder/components/IFrame.svelte'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { Label } from '$lib/components/ui/label'
	import { page } from '$app/stores'
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
	 * @property {string | null} [preview]
	 * @property {string} [head]
	 */

	/** @type {Props} */
	let { symbol, preview = null, head = '' } = $props()

	if (!preview) {
		get_preview()
	}
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

	async function handle_rename(e) {
		e.preventDefault()
		await actions.rename_library_symbol(symbol.id, new_name)
		invalidate('app:data')
		is_rename_open = false
	}

	async function save_symbol(data) {
		preview = data.preview
		await actions.save_library_symbol(symbol.id, data)
		is_editor_open = false
		invalidate('app:data')
	}

	let is_move_open = $state(false)
	let selected_group_id = $state(symbol.group)
	async function move_symbol() {
		is_move_open = false
		await actions.move_library_symbol(symbol.id, selected_group_id)
		invalidate('app:data')
	}

	let deleting = $state(false)
	async function delete_library_symbol() {
		is_delete_open = false
		await actions.delete_library_symbol(symbol.id)
		invalidate('app:data')
	}
</script>

<div class="relative w-full bg-gray-900 rounded-bl rounded-br">
	<button onclick={() => (is_editor_open = true)} class="w-full rounded-tl rounded-tr overflow-hidden">
		<IFrame srcdoc={preview} {head} />
	</button>
	<div class="w-full p-3 pt-2 bg-gray-900 truncate flex items-center justify-between">
		<div class="text-sm font-medium leading-none truncate" style="width: calc(100% - 2rem)">{symbol.name}</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<EllipsisVertical size={14} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Item onclick={() => (is_editor_open = true)}>
					<Code class="h-4 w-4" />
					<span>Edit</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => (is_move_open = true)}>
					<ArrowLeftRight class="h-4 w-4" />
					<span>Move</span>
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

<Dialog.Root bind:open={is_move_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="font-medium leading-none">Move to group</h4>
				<p class="text-muted-foreground text-sm">Select a group for this block</p>
			</div>
			<RadioGroup.Root bind:value={selected_group_id}>
				{#each $page.data.symbol_groups as group}
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value={group.id} id={group.id} />
						<Label for={group.id}>{group.name}</Label>
					</div>
				{/each}
			</RadioGroup.Root>
			<div class="flex justify-end">
				<Button onclick={move_symbol}>Move</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_editor_open}>
	<Dialog.Content escapeKeydownBehavior="ignore" class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4 gap-0">
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
