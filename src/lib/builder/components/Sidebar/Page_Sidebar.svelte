<script lang="ts">
	import PageOutline from './Page_Outline.svelte'
	import { outline, outlineInsertion, outlineBusy, outlineMessage, pageSidebarTab } from '$lib/builder/stores/app/outline'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import Sidebar_Symbol from './Sidebar_Symbol.svelte'
	import Content from '../Content.svelte'
	import { goto } from '$app/navigation'
	import { site_html } from '$lib/builder/stores/app/page'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Cuboid, SquarePen, ExternalLink, ListTree } from 'lucide-svelte'
	import { page as pageState } from '$app/state'
	import { PageTypes, PageEntries } from '$lib/pocketbase/collections'
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

	$effect(() => {
		if ($pageSidebarTab !== 'blocks') $outlineInsertion = null
	})
	let commit_task
</script>

<div class="sidebar primo-reset">
	<Tabs.Root bind:value={$pageSidebarTab} class="p-3">
		<Tabs.List class="w-full mb-4">
			<Tabs.Trigger value="outline" class="flex-1 min-w-0 flex gap-1 px-2 font-normal data-[state=active]:bg-[#1e1e20]">
				<ListTree class="w-3 shrink-0" />
				<span class="text-xs truncate">Outline</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="blocks" class="flex-1 min-w-0 flex gap-1 px-2 font-normal data-[state=active]:bg-[#1e1e20]">
				<Cuboid class="w-3 shrink-0" />
				<span class="text-xs truncate">Blocks</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="content" class="flex-1 min-w-0 flex gap-1 px-2 font-normal data-[state=active]:bg-[#1e1e20]">
				<SquarePen class="w-3 shrink-0" />
				<span class="text-xs truncate">Fields</span>
			</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="outline"><PageOutline /></Tabs.Content>
		<Tabs.Content value="blocks">
			{@render symbols()}
		</Tabs.Content>
		<Tabs.Content value="content">
			{@render content()}
		</Tabs.Content>
	</Tabs.Root>
	{#if $outlineBusy}<p class="px-4 pb-3 text-xs text-muted-foreground" role="status">Saving…</p>{:else if $outlineMessage}<p class="px-4 pb-3 text-xs text-muted-foreground" role="status">
			{$outlineMessage}
		</p>{/if}
</div>

{#snippet symbols()}
	<div class="tab-heading"><span>Blocks</span>
	{#if $current_user?.siteRole === 'developer'}
		<button
			class="manage-action"
			onclick={() => {
				const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
				goto(`${base_path}/page-type--${page_type?.id}?tab=blocks`)
			}}
		>
			Manage blocks <ExternalLink class="w-3" />
		</button>
	{/if}
	</div>

	<div class="symbols">
		{#if $site_html !== null}
			{#each available_symbols ?? [] as symbol, i (symbol.id)}
				<div>
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
{/snippet}

{#snippet content()}
	<div class="tab-heading"><span>Fields</span>
	{#if $current_user?.siteRole === 'developer'}
		<button
			class="manage-action"
			onclick={() => {
				const base_path = pageState.url.pathname.startsWith('/admin/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
				goto(`${base_path}/page-type--${page_type?.id}?tab=fields`)
			}}
		>
			Manage fields
			<ExternalLink class="w-3" />
		</button>
	{/if}
	</div>
	{#if page && page_type_fields && page_entries}
		{#if page_type_fields.length === 0}
			<div class="fields-empty">
				<div class="fields-empty-icon" aria-hidden="true"><SquarePen size={19} strokeWidth={1.5} /></div>
				<h3>No page fields yet</h3>
				<p>{ $current_user?.siteRole === 'developer' ? 'Use Manage fields to set up content that belongs to the page as a whole.' : 'No additional content fields are set up for this page.' }</p>
				<div class="fields-empty-note">Block content is editable directly on the page or through <span>Edit content</span>.</div>
			</div>
		{:else}
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
	{/if}
{/snippet}

<style lang="postcss">
	.fields-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 11px; padding: 22px 14px 18px; border: 1px solid #343437; border-radius: 6px; background: #202023; }
	.fields-empty-icon { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid #3b3b40; border-radius: 7px; color: #96969f; margin-bottom: 3px; }
	.fields-empty h3 { color: #e4e4e7; font-size: 13px; font-weight: 500; line-height: 1.4; margin: 0; }
	.fields-empty p { color: #a1a1aa; font-size: 12px; line-height: 1.6; margin: 0; }
	.fields-empty-note { color: #85858f; font-size: 11px; line-height: 1.6; padding-top: 13px; margin-top: 3px; border-top: 1px solid #343437; width: 100%; }
	.fields-empty-note span { color: #b5b5be; }

	.tab-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 10px; padding: 4px 4px 14px; color: #e4e4e7; font-size: 13px; }
	.manage-action { display: inline-flex; align-items: center; gap: 5px; color: #a1a1aa; font-size: 11px; padding: 4px 0; border-radius: 3px; }
	.manage-action:hover { color: #f4f4f5; }
	.manage-action:focus-visible { outline: 2px solid #956e51; outline-offset: 3px; }

	.sidebar {
		width: 100%;
		/* background: #171717; */
		background: #1e1e20;
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
		gap: 1.25rem;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
