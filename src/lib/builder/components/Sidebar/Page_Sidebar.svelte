<script lang="ts">
	import * as _ from 'lodash-es'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { dragging_symbol } from '$lib/builder/stores/app/misc'
	import Sidebar_Symbol from './Sidebar_Symbol.svelte'
	import Content from '../Content.svelte'
	import { Button } from '$lib/components/ui/button'
	import { goto } from '$app/navigation'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { site_html } from '$lib/builder/stores/app/page'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Cuboid, SquarePen, ExternalLink } from 'lucide-svelte'
	import { page as pageState } from '$app/state'
	import { PageTypes, Sites, Pages, PageEntries } from '$lib/pocketbase/collections'
	import { SiteSymbols } from '$lib/pocketbase/collections'
	import { site_context } from '$lib/builder/stores/context'
	import { setFieldEntries } from '../Fields/FieldsContent.svelte'
	import { current_user } from '$lib/pocketbase/user'
	import { author_mode } from '$lib/pocketbase/author_mode'
	import { resolve_page } from '$lib/pages'
	import { self } from '$lib/pocketbase/managers'

	const { value: site } = site_context.getOr({ value: null })
	const path = $derived(pageState.params.page?.split('/'))
	const page = $derived(site && (path ? resolve_page(site, path) : site.homepage()))
	const page_type = $derived(page && PageTypes.one(page.page_type))
	const page_type_fields = $derived(page_type?.fields())
	const page_entries = $derived(page?.entries())
	const page_type_symbols = $derived(page_type?.symbols() ?? [])
	const available_symbols = $derived(page_type_symbols.map(({ symbol }) => SiteSymbols.one(symbol)).filter((symbol) => !!symbol))
	const has_symbols = $derived(available_symbols?.length !== 0)

	function drag_target(element, block) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ block },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDragStart() {
				$dragging_symbol = true
			},
			onDragEnd() {
				$dragging_symbol = false
			},
			onDrop({ self, source }) {
				$dragging_symbol = false
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (closestEdgeOfTarget === 'top') {
					// TODO: Implement
					throw new Error('Not implemented')
				} else if (closestEdgeOfTarget === 'bottom') {
					// TODO: Implement
					throw new Error('Not implemented')
				}
			}
		})
	}

	let commit_task
</script>

<div class="sidebar primo-reset">
	{#if has_symbols}
		<Tabs.Root value="blocks" class="p-2">
			<Tabs.List class="w-full mb-2">
				<Tabs.Trigger value="blocks" class="flex-1 flex gap-1">
					<Cuboid class="w-3" />
					<span class="text-xs">Blocks</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="content" class="flex-1 flex gap-1">
					<SquarePen class="w-3" />
					<span class="text-xs">Fields</span>
				</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="blocks">
				{@render symbols()}
			</Tabs.Content>
			<Tabs.Content value="content">
				{@render content()}
			</Tabs.Content>
		</Tabs.Root>
	{:else}
		{@render content()}
	{/if}
</div>

{#snippet symbols()}
	<div class="symbols">
		{#if $site_html !== null}
			{#each available_symbols ?? [] as symbol, i (symbol.id)}
				<div use:drag_target={symbol}>
					<Sidebar_Symbol {symbol} controls_enabled={false} head={$site_html} active_page_type_id={page_type?.id} toggled={true} />
				</div>
			{/each}
		{:else}
			<!-- Loading skeletons for blocks list -->
			<div class="block-skeletons pt-2">
				{#each Array(4) as _, i}
					<div class="skeleton-item mb-4">
						<div class="flex items-center justify-between pb-2">
							<Skeleton class="h-4 w-28" />
						</div>
						<Skeleton class="h-24 w-full rounded-md" />
					</div>
				{/each}
			</div>
		{/if}
	</div>
	{#if $current_user?.siteRole === 'developer'}
		<Button
			class="mt-4"
			size="sm"
			variant="outline"
			onclick={() => {
				const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
				goto(`${base_path}/page-type--${page_type?.id}?tab=blocks`)
			}}
		>
			Manage Blocks <ExternalLink class="w-3" />
		</Button>
	{/if}
{/snippet}

{#snippet content()}
	{#if page && page_type_fields && page_entries}
		<div class="page-type-fields" class:p-2={!has_symbols}>
			<Content
				entity={page}
				fields={page_type_fields}
				entries={page_entries}
				oninput={(values) => {
					if ($author_mode === 'files') return
					setFieldEntries({
						fields: page_type_fields,
						entries: page_entries,
						updateEntry: PageEntries.update,
						createEntry: (data) => PageEntries.create({ ...data, page: page.id }),
						values
					})
					clearTimeout(commit_task)
					commit_task = setTimeout(() => self.commit(), 500)
				}}
				ondelete={(entry_id) => {
					if ($author_mode === 'files') return
					PageEntries.delete(entry_id)
					clearTimeout(commit_task)
					commit_task = setTimeout(() => self.commit(), 500)
				}}
			/>
		</div>
	{/if}
	{#if $current_user?.siteRole === 'developer'}
		<Button
			class="py-3 mt-2"
			size="sm"
			variant="outline"
			onclick={() => {
				const base_path = pageState.url.pathname.startsWith('/admin/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
				goto(`${base_path}/page-type--${page_type?.id}?tab=fields`)
			}}
		>
			Manage Fields
			<ExternalLink class="w-3" />
		</Button>
	{/if}
{/snippet}

<style lang="postcss">
	.sidebar {
		width: 100%;
		/* background: #171717; */
		background: #111;
		z-index: 9;
		display: flex;
		flex-direction: column;
		height: 100%;
		flex: 1;
		/* gap: 0.5rem; */
		z-index: 9;
		position: relative;
		overflow: auto;
		/* padding-top: 0.5rem; */
	}

	.page-type-fields {
		flex: 1;
	}

	.symbols {
		gap: 1rem;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
