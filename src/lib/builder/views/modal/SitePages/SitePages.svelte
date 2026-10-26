<script lang="ts">
	import { page as pageState } from '$app/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import Item from './Item.svelte'
	import PageForm from './PageForm.svelte'
	import Icon from '@iconify/svelte'
	import Spinner from '../../../ui/Spinner.svelte'
	import { Pages, PageTypes, PageSections, PageSectionEntries, PageEntries } from '$lib/pocketbase/collections'
	import { resolve_page } from '$lib/pages'
	import { site_context } from '$lib/builder/stores/context'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import type { Page } from '$lib/common/models/Page'
	import { self } from '$lib/pocketbase/managers'
	import { flip } from 'svelte/animate'
	import { tick } from 'svelte'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { create_entity_entries as copyEntries } from '$lib/workers/CopyEntries.svelte'
	import type { Entry } from '$lib/common/models/Entry'
	import type { PageTypeSection } from '$lib/common/models/PageTypeSection'
	import type { PageTypeSectionEntry } from '$lib/common/models/PageTypeSectionEntry'
	import { read_only } from '$lib/pocketbase/author_mode'
	import { reorderedPages } from './page-order'
	import { toast } from 'svelte-sonner'

	let { onManagePageTypes }: { onManagePageTypes?: () => void } = $props()

	let hover_position = $state<string | null>(null)

	function gapDropTarget(node: HTMLElement, page: ObjectOf<typeof Pages>) {
		const targetPage = () => (page.id === homepage?.id ? [...root_pages].sort((a, b) => a.index - b.index)[0] : page)
		const cleanup = dropTargetForElements({
			element: node,
			canDrop: ({ source }) => !$read_only && !!source.data.page && !!targetPage() && (source.data.page as Page).parent === targetPage()?.parent,
			getData({ input }) {
				return attachClosestEdge(
					{ page },
					{
						element: node,
						input,
						allowedEdges: ['top']
					}
				)
			},
			onDrag({ self, source }) {
				const page_being_dragged = source.data.page as ObjectOf<typeof Pages>
				const same_parent = targetPage()?.parent === page_being_dragged.parent
				if (!same_parent) {
					hover_position = null
					return
				}

				const edge = extractClosestEdge(self.data)
				if (edge === 'top') {
					hover_position = `${page.id}-bottom`
				}
			},
			onDragLeave() {
				hover_position = null
			},
			onDrop({ source }) {
				hover_position = null
				if ($read_only) return
				const target = targetPage()
				if (!target) return
				const updates = reorderedPages(all_pages, source.data.page as Page, target, page.id === homepage?.id ? 'top' : 'bottom', target.parent === homepage?.id ? 1 : 0)
				if (!updates.length) return
				for (const { id, index } of updates) Pages.update(id, { index })
				void self.commit().catch((error) => toast.error(error instanceof Error ? error.message : 'Could not reorder pages. Please try again.'))
			}
		})

		return {
			destroy() {
				cleanup()
			}
		}
	}

	// Get site from context (preferred) or fallback to hostname lookup
	const { value: site } = site_context.get()
	const page_slug = $derived(pageState.params.page)
	const current_path = $derived(pageState.params.page?.split('/'))
	const active_page = $derived(current_path ? resolve_page(site, current_path) : site.homepage())

	const homepage = $derived(site.homepage())
	const all_pages = $derived(site.pages() ?? [])
	// The toolbar already loads the site's pages. A separate children() query
	// first renders only Home, then resizes the centered dialog when it resolves.
	const root_pages = $derived(all_pages.filter((page) => page.parent === homepage?.id))

	let creating_page = $state(false)
	let building_page = $state(false)
	let building_page_name = $state('')
	let building_page_id = $state('')
	let building_page_parent = $state('')
	let page_list = $state<HTMLUListElement>()
	let page_list_height = $state<number>()

	function revealCreatingPage(node: HTMLElement, pending: boolean) {
		let observer: ResizeObserver | undefined
		let was_pending = false
		let generation = 0

		function reveal() {
			if (!page_list || !node.isConnected || node.getClientRects().length === 0) return
			const list_rect = page_list.getBoundingClientRect()
			const row_rect = node.getBoundingClientRect()
			const top = list_rect.top + page_list.clientTop + 4
			const bottom = list_rect.top + page_list.clientTop + page_list.clientHeight - 4
			// Scroll only the list, by the distance needed to reveal the row.
			// scrollIntoView can also move the dialog or the document.
			if (row_rect.bottom > bottom) page_list.scrollTop += row_rect.bottom - bottom
			else if (row_rect.top < top) page_list.scrollTop -= top - row_rect.top
		}

		async function update(pending: boolean) {
			const current_generation = ++generation
			observer?.disconnect()
			if (!pending && !was_pending) return
			was_pending = pending
			await tick()
			if (current_generation !== generation) return
			reveal()
			const ancestors: HTMLElement[] = [node]
			for (let parent = node.parentElement; parent && parent !== page_list; parent = parent.parentElement) ancestors.push(parent)
			if (pending && page_list && node.isConnected) {
				observer = new ResizeObserver(reveal)
				observer.observe(page_list)
				for (const element of ancestors) observer.observe(element)
			}
			// Expanding child lists and FLIP animations can move the row without
			// changing its own size. Check its final position once they settle.
			// Svelte replaces its setup animation with the actual slide/FLIP
			// animation in onfinish. Re-read after a frame so finishing the setup
			// animation does not leave the row clipped when the real one ends.
			while (current_generation === generation) {
				const animations = ancestors.flatMap((element) => element.getAnimations())
				if (animations.length === 0) break
				await Promise.allSettled(animations.map((animation) => animation.finished))
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
			}
			if (current_generation === generation) reveal()
		}

		void update(pending)
		return {
			update,
			destroy() {
				generation++
				observer?.disconnect()
			}
		}
	}

	async function create_page_with_sections(page_data: Omit<Page, 'id' | 'index'>) {
		// Guard the mutation, not just the trigger: a form already open when the
		// mode flips would otherwise still submit.
		if ($read_only) return
		if (building_page) throw new Error('Another page is being created. Please wait for it to finish.')

		// Get existing siblings and find the max index
		const sibling_pages = all_pages.filter((page) => page.parent === page_data.parent)
		const maxIndex = sibling_pages.length > 0 ? Math.max(...sibling_pages.map((p) => p.index)) : -1
		const new_index = maxIndex + 1

		// Create the page with the next available index
		// Retain the list size while the form becomes a row, keeping the dialog in place.
		page_list_height = page_list?.getBoundingClientRect().height
		building_page = true
		building_page_name = page_data.name
		building_page_parent = page_data.parent
		let new_page: ObjectOf<typeof Pages> | undefined
		try {
			const instance = self.instance
			if (!instance) throw new Error('The editor is not connected. Please try again.')
			new_page = Pages.create({ ...page_data, index: new_index })
			building_page_id = new_page.id

			// Load one complete snapshot before copying. Reactive copy workers
			// can be replaced when creating a section invalidates their source
			// lists, leaving multi-section templates stuck halfway through.
			const [page_entries, sections, section_entries] = await Promise.all([
				instance.collection('page_type_entries').getFullList<Entry>({ filter: instance.filter('field.page_type = {:type}', { type: page_data.page_type }) }),
				instance.collection('page_type_sections').getFullList<PageTypeSection>({ filter: instance.filter('page_type = {:type}', { type: page_data.page_type }), sort: 'index' }),
				instance.collection('page_type_section_entries').getFullList<PageTypeSectionEntry>({ filter: instance.filter('section.page_type = {:type}', { type: page_data.page_type }) })
			])
			copyEntries({ source_entity_entries: page_entries, destination_entity: new_page })
			for (const section of sections) {
				if (section.zone === 'header' || section.zone === 'footer') continue
				const destination = PageSections.create({ page: new_page.id, symbol: section.symbol, index: section.index })
				copyEntries({ source_entity_entries: section_entries.filter((entry) => entry.section === section.id), destination_entity: destination })
			}
			await self.commit()
		} catch (error) {
			const page_id = new_page?.id
			if (page_id) {
				// Remove only this failed creation's changes; keep other edits intact.
				const section_ids = new Set(
					[...self.changes].filter(([, change]) => 'data' in change && change.collection === 'page_sections' && (change.data as Record<string, unknown>).page === page_id).map(([id]) => id)
				)
				for (const [id, change] of [...self.changes]) {
					if (id === page_id || ('data' in change && ((change.data as Record<string, unknown>).page === page_id || section_ids.has((change.data as Record<string, unknown>).section as string))))
						self.changes.delete(id)
				}
				if (self.records.get(page_id)?.data) {
					try {
						await self.instance?.collection('pages').delete(page_id)
						self.records.set(page_id, null)
					} catch (cleanup_error) {
						console.error('Could not remove partially created page', cleanup_error)
					}
				}
			}
			throw error
		} finally {
			building_page = false
		}
	}
</script>

{#snippet creatingPageRow()}
	<div class="building-page-item" role="status">
		<Spinner decorative />
		<span>Creating {building_page_name}…</span>
	</div>
{/snippet}

<div class="pages-heading">
	<Dialog.Title class="text-base font-medium">
		Pages <span class="page-count">{all_pages.length}</span>
	</Dialog.Title>
	{#if onManagePageTypes}<button class="manage-types" data-testid="manage-page-types" onclick={onManagePageTypes}><Icon icon="lucide:layout-template" />Manage page types</button>{/if}
</div>
<p class="pages-description">Open a page to edit its content, or create a new one.</p>
{#if active_page && homepage}
	<ul class="grid page-list" bind:this={page_list} style:height={page_list_height === undefined ? undefined : `${page_list_height}px`}>
		{#each [homepage, ...root_pages].sort((a, b) => a.index - b.index) as page, i (page.id)}
			<li animate:flip={{ duration: 200 }} use:revealCreatingPage={building_page && page.id === building_page_id}>
				{#if building_page && page.id === building_page_id}
					{@render creatingPageRow()}
				{:else}
					<Item
						{page}
						{page_slug}
						active_page_id={!pageState.params.page_type ? active_page.id : null}
						oncreate={create_page_with_sections}
						creating_page_id={building_page ? building_page_id : null}
						{creatingPageRow}
						{revealCreatingPage}
						bind:hover_position
					/>
				{/if}
				<div class="drop-indicator-inline" class:active={hover_position === `${page.id}-bottom`}><div></div></div>
				<div class="drop-target-gap" use:gapDropTarget={page}></div>
			</li>
		{/each}
		{#if creating_page && !$read_only}
			<li hidden={building_page && building_page_parent === homepage.id} use:revealCreatingPage={!building_page}>
				<PageForm
					oncreate={async (new_page: any) => {
						if (!homepage || $read_only) return
						const url_taken = all_pages.some((page) => page?.slug === new_page.slug && page.parent === homepage.id)
						if (url_taken) {
							throw new Error('That URL is already in use')
						} else {
							await create_page_with_sections({ ...new_page, parent: homepage.id, site: site.id })
							creating_page = false
						}
					}}
				/>
			</li>
		{:else if !$read_only}
			<li>
				<button class="create-page-btn" disabled={building_page} onclick={() => (creating_page = true)}>
					<Icon icon="akar-icons:plus" />
					<span>Create page</span>
				</button>
			</li>
		{/if}
	</ul>
{/if}

<style lang="postcss">
	.page-count {
		font-size: 12px;
		font-weight: 400;
		color: #a1a1aa;
		margin-left: 6px;
	}
	.pages-description {
		font-size: 12px;
		line-height: 1.5;
		color: #a1a1aa;
		margin: -4px 0 0;
	}
	.page-list {
		min-height: 0;
		grid-template-columns: minmax(0, 1fr);
		padding: 4px;
		border: 1px solid #343437;
		border-radius: 7px;
		background: #19191b;
		align-content: start;
	}
	.create-page-btn {
		border: 1px solid #3a3a40;
		margin-top: 6px;
		min-height: 38px;
	}
	.create-page-btn:focus-visible {
		outline: 2px solid #956e51;
		outline-offset: -2px;
	}

	.pages-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px;
		padding-left: 28px;
	}
	.manage-types {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 9px;
		border: 1px solid #3a3a40;
		border-radius: 5px;
		color: #c4c4cc;
		font-size: 12px;
	}
	.manage-types:hover {
		background: #ffffff0a;
		color: white;
	}
	.manage-types:focus-visible {
		outline: 2px solid #956e51;
		outline-offset: 2px;
	}

	.page-list {
		overflow: auto;

		> li {
			position: relative;
			min-width: 0;
		}

		.drop-target-gap {
			width: 100%;
			height: 3px;
			display: block;
			pointer-events: auto;
		}

		.drop-indicator-inline {
			pointer-events: none;
			height: 4px;
			display: flex;
			align-items: center;
			padding: 0 8px;
			position: absolute;
			/* bottom: -6px; */
			left: 0;
			right: 0;
			z-index: 10;

			div {
				width: 100%;
				height: 2px;
				background: transparent;
				border-radius: 1px;
				transition: all 0.2s ease;
				opacity: 0;
			}

			&.active div {
				opacity: 1;
				background: var(--primo-primary-color);
				height: 3px;
				animation: pulse 0.6s ease-in-out infinite;
			}
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.create-page-btn {
		font-size: 13px;
		width: 100%;
		padding: 12px;
		background: #252528;
		border-radius: var(--primo-border-radius);
		display: flex;
		justify-content: center;
		gap: 0.25rem;
		align-items: center;
		transition: 0.1s;
		color: var(--color-gray-3);

		&:hover {
			border-color: var(--primo-primary-color);
			color: var(--primo-primary-color);
		}

		&:disabled {
			opacity: 0.5;
			cursor: wait;
		}
	}

	.building-page-item {
		background: #252528;
		border: 1px dashed var(--color-gray-6);
		border-radius: var(--primo-border-radius);
		padding: calc(0.875rem - 1px) calc(1.125rem - 1px);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-gray-3);
		font-size: 0.875rem;
		line-height: 1.5rem;

		span {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		:global(svg) {
			height: 1rem;
			width: 1rem;
			flex-shrink: 0;
		}
	}
</style>
