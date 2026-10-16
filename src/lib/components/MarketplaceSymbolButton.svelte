<script>
	import { toast } from 'svelte-sonner'
	import { Label } from '$lib/components/ui/label'
	import * as Popover from '$lib/components/ui/popover'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import { CirclePlus, CircleCheck } from 'lucide-svelte'
	import { find as _find } from 'lodash-es'
	import { Button, buttonVariants } from '$lib/components/ui/button'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { SiteSymbol } from '$lib/common/models/SiteSymbol'
	import { LibrarySymbolGroups } from '$lib/pocketbase/collections'

	/**
	 * @typedef {Object} Props
	 * @property {SiteSymbol} symbol
	 * @property {string | null} [preview]
	 * @property {string} [head]
	 */

	/** @type {Props} */
	let { symbol, preview = null, head = '' } = $props()


	let selected_group_id = $state(LibrarySymbolGroups.list()?.[0]?.id ?? '')

	let is_popover_open = $state(false)
	let added_to_library = $state(false)
	async function add_to_library() {
		// await actions.add_marketplace_symbol_to_library({ symbol, preview, group_id })
		// TODO: Implement
		throw new Error('Not implemented')
		toast.success('Added Block to Library')
		added_to_library = true
	}
</script>

<div class="space-y-3 relative w-full bg-gray-900">
	<div class="w-full rounded-tl rounded-tr overflow-hidden h-[10rem] aspect-[1.5]">
		<SitePreview />
	</div>
	<div class="absolute -bottom-2 rounded-bl rounded-br w-full p-3 z-20 bg-gray-900 truncate flex items-center justify-between">
		<div class="text-sm font-medium leading-none">{symbol.name}</div>
		<Popover.Root bind:open={is_popover_open}>
			<Popover.Trigger class={buttonVariants({ variant: 'ghost', class: 'h-4 p-0' })}>
				{#if added_to_library}
					<CircleCheck />
				{:else}
					<CirclePlus />
				{/if}
			</Popover.Trigger>
			<Popover.Content class="w-80">
				<div class="grid gap-4">
					<div class="space-y-2">
						<h4 class="font-medium leading-none">Add to Library</h4>
						<p class="text-muted-foreground text-sm">Select a group for this block</p>
					</div>
					<RadioGroup.Root bind:value={selected_group_id}>
						{#each LibrarySymbolGroups.list() ?? [] as group}
							<div class="flex items-center space-x-2">
								<RadioGroup.Item value={group.id} id={group.id} />
								<Label for={group.id}>{group.name}</Label>
							</div>
						{/each}
					</RadioGroup.Root>
					<div class="flex justify-end">
						<Button
							onclick={() => {
								add_to_library()
								is_popover_open = false
							}}
						>
							Add to Library
						</Button>
					</div>
				</div>
			</Popover.Content>
		</Popover.Root>
	</div>
</div>
