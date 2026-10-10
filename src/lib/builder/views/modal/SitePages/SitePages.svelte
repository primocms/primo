<script lang="ts">
	import { page as pageState } from '$app/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import Item from './Item.svelte'
	import PageForm from './PageForm.svelte'
	import Icon from '@iconify/svelte'
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
	import { useCopyEntries } from '$lib/workers/CopyEntries.svelte'
	import { read_only } from '$lib/pocketbase/author_mode'
	import { revealRow } from './reveal-row'

	let { onManagePageTypes }: { onManagePageTypes?: () => void } = $props()

	let hover_position = $state<string | null>(null)

	function gapDropTarget(node: HTMLElement, page: ObjectOf<typeof Pages>) {
		dropTargetForElements({
			element: node,
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
				const same_parent = page.parent === page_being_dragged.parent
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
			}
		})

		return {
			destroy() {
				// Cleanup if needed
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
	let new_page = $state<ObjectOf<typeof Pages>>()
	let finish_creation: ((error?: unknown) => void) | undefined
	let committing_page = false
	let new_page_page_type = $derived(new_page && PageTypes.one(new_page.page_type))
	let new_page_page_type_sections = $derived(new_page_page_type?.sections())

	const copy_page_type_entries = $derived(useCopyEntries([new_page_page_type]))
	const copy_page_type_section_entries = $derived(useCopyEntries(new_page_page_type_sections))

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
			const animations = ancestors.flatMap((element) => element.getAnimations())
			await Promise.allSettled(animations.map((animation) => animation.finished))
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

	// Copy page type entries
	let copying_page_type_entries: 'no' | 'working' | 'done' = $state('no')
	$effect(() => {
		if (!new_page || !new_page_page_type || !copy_page_type_entries || copying_page_type_entries !== 'no') {
			return
		}

		copying_page_type_entries = 'working'
		copy_page_type_entries
			.run(new_page_page_type, new_page)
			.then(() => {
				copying_page_type_entries = 'done'
			})
			.catch((error) => finish_creation?.(error))
	})

	// Copy page type sections to new page
	let copying_page_type_section_entries: 'no' | 'working' | 'done' = $state('no')
	$effect(() => {
		if (!new_page || !new_page_page_type_sections || !copy_page_type_section_entries || copying_page_type_section_entries !== 'no' || copying_page_type_entries !== 'done') {
			return
		}

		copying_page_type_section_entries = 'working'
		let promise = Promise.resolve()
		for (const pts of new_page_page_type_sections) {
			// Skip header and footer sections - these are handled at the site level
			if (pts.zone === 'header' || pts.zone === 'footer') {
				continue
			}
			// Create the page section
			const page_section = PageSections.create({
				page: new_page.id,
				symbol: pts.symbol,
				index: pts.index
			})
			promise = promise.then(() => copy_page_type_section_entries.run(pts, page_section))
		}

		promise
			.then(async () => {
				copying_page_type_section_entries = 'done'
			})
			.catch((error) => finish_creation?.(error))
	})

	$effect(() => {
		if (new_page && !committing_page && copying_page_type_entries === 'done' && copying_page_type_section_entries === 'done') {
			committing_page = true
			self.commit().then(
				() => finish_creation?.(),
				(error) => finish_creation?.(error)
			)
		}
	})

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
		return new Promise<string>((resolve, reject) => {
			finish_creation = async (error) => {
				const page_id = new_page?.id
				new_page = undefined
				finish_creation = undefined
				if (error && page_id) {
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
				building_page = false
				committing_page = false
				copying_page_type_entries = 'no'
				copying_page_type_section_entries = 'no'
				if (error) reject(error)
				else resolve(page_id!)
			}
			new_page = Pages.create({ ...page_data, index: new_index })
			building_page_id = new_page.id
		})
	}
</script>

{#snippet creatingPageRow()}
	<div class="building-page-item" role="status">
		<Icon icon="eos-icons:three-dots-loading" />
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
							const page_id = await create_page_with_sections({ ...new_page, parent: homepage.id, site: site.id })
							creating_page = false
							if (page_id && page_list) await revealRow(page_list, page_id)
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
		}

		.drop-target-gap {
			width: 100%;
			height: 3px;
			display: block;
			pointer-events: auto;
		}

		.drop-indicator-inline {
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
