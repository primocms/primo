<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Dialog from '$lib/components/ui/dialog'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'
	import { Input } from '$lib/components/ui/input'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { Label } from '$lib/components/ui/label'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import DropZone from '$lib/components/DropZone.svelte'
	import Masonry from '$lib/components/Masonry.svelte'
	import {
		CirclePlus,
		Cuboid,
		Code,
		Upload,
		Download,
		SquarePen,
		Trash2,
		ChevronDown,
		Loader,
		Loader2,
		EllipsisVertical,
		ArrowLeftRight,
		Info,
		Plus,
		MousePointer,
		Edit3,
		Share,
		Store
	} from 'lucide-svelte'
	import SymbolButton from '$lib/components/SymbolButton.svelte'
	import { browser } from '$app/environment'
	import { page } from '$app/state'
	import { beforeNavigate, goto } from '$app/navigation'
	import { useSidebar } from '$lib/components/ui/sidebar'
	import { LibrarySymbolGroups, LibrarySymbols, LibrarySymbolFields, LibrarySymbolEntries, SiteSymbols } from '$lib/pocketbase/collections'
	import type { LibrarySymbol } from '$lib/common/models/LibrarySymbol'
	import { useImportLibrarySymbol } from '$lib/workers/ImportSymbol.svelte'
	import { tick } from 'svelte'
	import { BlockEditor } from '$lib/builder/views/modal'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { useExportLibrarySymbol } from '$lib/workers/ExportSymbol.svelte'
	import { self } from '$lib/pocketbase/managers'

	const active_symbol_group_id = $derived(page.url.searchParams.get('group'))
	const active_symbol_id = $derived(page.url.searchParams.get('block'))
	const symbol_groups = $derived(LibrarySymbolGroups.list() ?? [])

	function update_library_url(search_params: Record<string, string | null | undefined>) {
		const url = new URL(page.url)
		for (const [key, value] of Object.entries(search_params)) {
			if (value) {
				url.searchParams.set(key, value)
			} else {
				url.searchParams.delete(key)
			}
		}
		goto(url, { replaceState: true, keepFocus: true, noScroll: true })
	}

	beforeNavigate((navigation) => {
		if (!browser || !active_symbol_id) return
		if (!navigation.to || navigation.to.url.pathname === page.url.pathname) return

		const url = new URL(page.url)
		url.searchParams.delete('block')
		window.history.replaceState(window.history.state, '', url)
	})

	// Auto-select first group if none selected and groups exist
	$effect(() => {
		if (!active_symbol_group_id && symbol_groups.length > 0) {
			update_library_url({ group: symbol_groups[0].id })
		}
	})

	const active_symbol_group = $derived(active_symbol_group_id ? LibrarySymbolGroups.one(active_symbol_group_id) : undefined)

	// Get symbols for the active group using direct query instead of relationship method
	const group_symbols = $derived(active_symbol_group?.symbols() ?? [])

	const sidebar = useSidebar()

	let creating_block = $state(false)
	let is_info_dialog_open = $state(false)

	function open_create_block() {
		creating_block = true
	}

	async function create_first_group() {
		const group = LibrarySymbolGroups.create({ name: 'Default', index: 0 })
		await self.commit()
		const url = new URL(page.url)
		url.searchParams.set('group', group.id)
		goto(url, { replaceState: true })
	}

	let file = $state<File>()
	let is_importing = $state(false)
	const importLibrarySymbol = $derived(useImportLibrarySymbol(file, active_symbol_group_id ?? undefined))
	async function upload_block_file(newFile) {
		file = newFile
		await tick()

		if (!file) return
		if (!active_symbol_group_id) {
			console.error('No active symbol group selected')
			return
		}

		is_importing = true
		try {
			await importLibrarySymbol.run()
			upload_dialog_open = false
			upload_file_invalid = false
			file = undefined
		} catch (error) {
			console.error('Failed to import symbol:', error)

			// Show more detailed error message
			if (error.response?.data) {
				console.error('PocketBase error details:', error.response.data)
			}

			upload_file_invalid = true
			file = undefined
		} finally {
			is_importing = false
		}
	}

	let is_rename_open = $state(false)
	let new_name = $state('')
	$effect(() => {
		if (active_symbol_group) {
			new_name = active_symbol_group.name
		}
	})
	async function handle_rename(e) {
		e.preventDefault()
		if (!active_symbol_group_id) return
		LibrarySymbolGroups.update(active_symbol_group_id, { name: new_name })
		await self.commit()
		is_rename_open = false
	}

	let is_delete_open = $state(false)
	let deleting = $state(false)

	// Upload dialog state
	let upload_dialog_open = $state(false)
	let upload_file_invalid = $state(false)

	// Export symbol
	let symbol_to_export = $state<ObjectOf<typeof SiteSymbols>>()
	const exportSymbol = $derived(useExportLibrarySymbol(symbol_to_export?.id))
	async function export_symbol(symbol: ObjectOf<typeof SiteSymbols>) {
		symbol_to_export = symbol
		await tick()
		await exportSymbol.run()
	}

	async function handle_delete() {
		deleting = true
		if (!active_symbol_group_id) return
		LibrarySymbolGroups.delete(active_symbol_group_id)
		await self.commit()
		await goto('/admin/dashboard/library')
		deleting = false
		is_delete_open = false
	}

	let symbol_being_edited = $state<ObjectOf<typeof LibrarySymbols>>()
	let is_symbol_editor_open = $state(false)

	function begin_symbol_edit(symbol: ObjectOf<typeof LibrarySymbols>) {
		update_library_url({ group: symbol.group, block: symbol.id })
	}

	$effect(() => {
		if (!active_symbol_id) {
			symbol_being_edited = undefined
			is_symbol_editor_open = false
			return
		}

		const symbol = LibrarySymbols.one(active_symbol_id)
		if (!symbol) return

		symbol_being_edited = symbol
		is_symbol_editor_open = true

		if (active_symbol_group_id !== symbol.group) {
			update_library_url({ group: symbol.group })
		}
	})

	// Symbol rename
	let symbol_being_renamed: LibrarySymbol | null = $state(null)
	let is_symbol_renamer_open = $state(false)
	let symbol_new_name = $state('')

	function begin_symbol_rename(symbol: LibrarySymbol) {
		symbol_being_renamed = symbol
		symbol_new_name = symbol.name
		is_symbol_renamer_open = true
	}

	async function handle_symbol_rename(e) {
		e.preventDefault()
		if (!symbol_being_renamed) return
		LibrarySymbols.update(symbol_being_renamed.id, { name: symbol_new_name })
		await self.commit()
		is_symbol_renamer_open = false
		symbol_being_renamed = null
	}

	// Symbol move
	let symbol_being_moved: LibrarySymbol | null = $state(null)
	let is_symbol_move_open = $state(false)
	let selected_group_id = $state('')

	function begin_symbol_move(symbol: LibrarySymbol) {
		symbol_being_moved = symbol
		const original_group_id = symbol.group
		selected_group_id = original_group_id ?? ''
		is_symbol_move_open = true
	}

	async function move_symbol() {
		if (!symbol_being_moved) return
		LibrarySymbols.update(symbol_being_moved.id, { group: selected_group_id })
		await self.commit()
		is_symbol_move_open = false
		symbol_being_moved = null
	}

	// Symbol delete
	let symbol_being_deleted: LibrarySymbol | null = $state(null)
	let is_delete_symbol_open = $state(false)

	function begin_symbol_delete(symbol: LibrarySymbol) {
		symbol_being_deleted = symbol
		is_delete_symbol_open = true
	}

	async function delete_library_symbol() {
		if (!symbol_being_deleted) return
		deleting = true
		LibrarySymbols.delete(symbol_being_deleted.id)
		await self.commit()
		is_delete_symbol_open = false
		symbol_being_deleted = null
		deleting = false
	}

	let creating_block_has_unsaved_changes = $state(false)
	let editing_block_has_unsaved_changes = $state(false)
</script>

<!-- Symbol Group Dialogs -->
<Dialog.Root bind:open={is_rename_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename group</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your group</p>
		<form onsubmit={handle_rename}>
			<Input bind:value={new_name} placeholder="Enter new group name" class="my-4" />
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
				This action cannot be undone. This will permanently delete <strong>{active_symbol_group?.name}</strong>
				and
				<strong>all</strong>
				it's blocks.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handle_delete} class="bg-red-600 hover:bg-red-700">
				{#if deleting}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {active_symbol_group?.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">{active_symbol_group?.name}</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button {...props}>
						<ChevronDown class="h-4" />
						<span class="sr-only">More</span>
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56 rounded-lg" side="bottom" align={sidebar.isMobile ? 'end' : 'start'}>
				<DropdownMenu.Item onclick={() => (is_rename_open = true)}>
					<SquarePen class="text-muted-foreground" />
					<span>Rename</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => (is_delete_open = true)}>
					<Trash2 class="text-muted-foreground" />
					<span>Delete</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<div class="ml-auto mr-4 flex gap-2">
		<Button size="sm" variant="ghost" onclick={() => (is_info_dialog_open = true)}>
			<Info class="h-4 w-4" />
		</Button>
		{#if active_symbol_group_id}
			<Button size="sm" variant="outline" onclick={open_create_block}>
				<CirclePlus class="h-4 w-4" />
				Create Block
			</Button>
			<Button size="sm" variant="outline" onclick={() => (upload_dialog_open = true)}>
				<Upload class="h-4 w-4" />
				Import Block
			</Button>
		{/if}
	</div>
</header>

<div class="flex flex-1 flex-col gap-4 px-4 pb-4 overflow-hidden">
	{#if symbol_groups.length === 0}
		<!-- No groups exist -->
		<EmptyState
			class="h-[50vh]"
			icon={Cuboid}
			title="No Block Groups"
			description="Create your first block group to start organizing your components."
			button={{
				label: 'Create First Group',
				icon: CirclePlus,
				onclick: create_first_group
			}}
		/>
	{:else}
		{#key active_symbol_group_id}
			{#if group_symbols === undefined}
				<!-- Loading state -->
				<div class="flex flex-col items-center justify-center gap-4 py-8">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
					<p class="text-sm text-muted-foreground">Loading blocks...</p>
				</div>
			{:else if group_symbols.length}
				<Masonry items={group_symbols}>
					{#snippet children(symbol)}
						<SymbolButton {symbol} onclick={() => begin_symbol_edit(symbol)}>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									<EllipsisVertical size={14} />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content>
									<DropdownMenu.Item onclick={() => begin_symbol_edit(symbol)}>
										<Code class="h-4 w-4" />
										<span>Edit</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => export_symbol(symbol)}>
										<Download class="h-4 w-4" />
										<span>Export</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => begin_symbol_move(symbol)}>
										<ArrowLeftRight class="h-4 w-4" />
										<span>Move</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => begin_symbol_rename(symbol)}>
										<SquarePen class="h-4 w-4" />
										<span>Rename</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => begin_symbol_delete(symbol)} class="text-red-500 hover:text-red-600 focus:text-red-600">
										<Trash2 class="h-4 w-4" />
										<span>Delete</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</SymbolButton>
					{/snippet}
				</Masonry>
			{:else}
				<div class="flex flex-col items-center justify-center gap-6 flex-1 h-[50vh]">
					<div class="flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full dark:bg-gray-800">
						<Cuboid class="w-10 h-10 text-gray-500 dark:text-gray-400" />
					</div>
					<div class="space-y-2 text-center">
						<h2 class="text-2xl font-bold tracking-tight">No Blocks to display</h2>
						<p class="text-gray-500 dark:text-gray-400 text-balance max-w-[30rem]">Blocks are components you can add to any site. When you create one it'll show up here.</p>
					</div>
					<div class="flex gap-3">
						<Button onclick={open_create_block} variant="outline">
							<CirclePlus class="h-4 w-4" />
							<span>Create Block</span>
						</Button>
						<Button onclick={() => goto('/admin/dashboard/marketplace/blocks')} variant="outline">
							<Store class="h-4 w-4" />
							<span>Browse Marketplace</span>
						</Button>
					</div>
				</div>
			{/if}
		{/key}
	{/if}
</div>

<!-- Symbol Dialogs -->
<Dialog.Root bind:open={is_symbol_move_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="font-medium leading-none">Move to group</h4>
				<p class="text-muted-foreground text-sm">Select a group for this block</p>
			</div>
			<RadioGroup.Root bind:value={selected_group_id}>
				{#each symbol_groups ?? [] as group}
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

<Dialog.Root
	bind:open={creating_block}
	onOpenChange={(open) => {
		if (!open) {
			// Check for unsaved changes before closing
			if (creating_block_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					// Prevent closing by reopening the dialog
					creating_block = true
					return
				}
				// User confirmed, discard changes
				self.discard()
			}
		}
	}}
>
	<Dialog.Content class="z-[999] w-[calc(100vw_-_1rem)] max-w-none h-[calc(100vh_-_1rem)] flex flex-col p-2 gap-2">
		<BlockEditor
			symbol_type="library"
			bind:has_unsaved_changes={creating_block_has_unsaved_changes}
			header={{
				title: `New Block`,
				button: {
					label: 'Save',
					onclick: () => {
						creating_block = false
					}
				}
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={is_symbol_editor_open}
	onOpenChange={(open) => {
		if (!open) {
			// Check for unsaved changes before closing
			if (editing_block_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					// Prevent closing by reopening the dialog
					is_symbol_editor_open = true
					return
				}
				// User confirmed, discard changes
				self.discard()
			}

			update_library_url({ block: null })
			symbol_being_edited = undefined
		}
	}}
>
	<Dialog.Content class="z-[999] w-[calc(100vw_-_1rem)] max-w-none h-[calc(100vh_-_1rem)] flex flex-col p-2 gap-2">
		<BlockEditor
			block={symbol_being_edited}
			symbol_type="library"
			bind:has_unsaved_changes={editing_block_has_unsaved_changes}
			header={{
				title: `Edit ${symbol_being_edited?.name || 'Block'}`,
				button: {
					label: 'Save',
					onclick: () => {
						update_library_url({ block: null })
					}
				}
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_symbol_renamer_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename Block</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your Block</p>
		<form onsubmit={handle_symbol_rename}>
			<Input bind:value={symbol_new_name} placeholder="Enter new Block name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_symbol_renamer_open = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={is_delete_symbol_open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete <strong>{symbol_being_deleted?.name}</strong>
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
					Delete {symbol_being_deleted?.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Upload Symbol Dialog -->
<Dialog.Root bind:open={upload_dialog_open}>
	<Dialog.Content class="sm:max-w-[500px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Import Block</h2>
		<p class="text-muted-foreground text-sm mb-4">Import a block from a JSON file exported from another site.</p>

		{#if is_importing}
			<div class="flex items-center justify-center py-8">
				<div class="animate-spin">
					<Loader class="h-8 w-8" />
				</div>
				<span class="ml-3">Importing block...</span>
			</div>
		{:else}
			<DropZone onupload={upload_block_file} invalid={upload_file_invalid} drop_text="Drop your block file here or click to browse" accept=".json" class="mb-4" />
		{/if}

		<Dialog.Footer>
			<Button
				type="button"
				variant="outline"
				onclick={() => {
					upload_dialog_open = false
					upload_file_invalid = false
				}}
				disabled={is_importing}
			>
				Cancel
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_info_dialog_open}>
	<Dialog.Content class="sm:max-w-[525px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">How Blocks Work in Pala</h2>
		<p class="text-muted-foreground text-sm mb-6">Blocks are reusable components that you can add to any page on your sites.</p>

		<div class="space-y-4">
			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<Plus class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Create or Import Blocks</h3>
					<p class="text-muted-foreground text-sm">Build custom blocks using the visual editor or import blocks from other sites. Organize them into groups for easy management.</p>
				</div>
			</div>

			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<MousePointer class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Add Blocks to Pages</h3>
					<p class="text-muted-foreground text-sm">When editing a page, drag blocks from the sidebar into your page layout. Blocks can be positioned anywhere and customized with different content.</p>
				</div>
			</div>

			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<Edit3 class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Customize Content</h3>
					<p class="text-muted-foreground text-sm">Each block can have different content on different pages. Edit text, images, and other content directly in the page editor.</p>
				</div>
			</div>

			<div class="flex gap-4">
				<div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
					<Share class="w-3 h-3" />
				</div>
				<div>
					<h3 class="font-medium text-sm mb-1">Reuse Across Sites</h3>
					<p class="text-muted-foreground text-sm">Export blocks to share with other sites or import blocks from the marketplace to expand your component library.</p>
				</div>
			</div>
		</div>

		<Dialog.Footer class="mt-6">
			<Button type="button" onclick={() => (is_info_dialog_open = false)}>Got it</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
