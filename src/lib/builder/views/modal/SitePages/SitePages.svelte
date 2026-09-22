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
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { useCopyEntries } from '$lib/workers/CopyEntries.svelte'
	import { read_only } from '$lib/pocketbase/author_mode'

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
	const root_pages = $derived(homepage?.children() || [])

	let creating_page = $state(false)
	let building_page = $state(false)
	let building_page_name = $state('')
	let new_page = $state<ObjectOf<typeof Pages>>()
	let new_page_page_type = $derived(new_page && PageTypes.one(new_page.page_type))
	let new_page_page_type_sections = $derived(new_page_page_type?.sections())

	const copy_page_type_entries = $derived(useCopyEntries([new_page_page_type]))
	const copy_page_type_section_entries = $derived(useCopyEntries(new_page_page_type_sections))

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
			.catch((error) => console.error(error))
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
			.catch((error) => console.error(error))
	})

	$effect(() => {
		if (building_page && copying_page_type_entries === 'done' && copying_page_type_section_entries === 'done') {
			new_page = undefined
			self
				.commit()
				.catch((error) => console.error(error))
				.finally(() => {
					building_page = false
					copying_page_type_entries = 'no'
					copying_page_type_section_entries = 'no'
				})
		}
	})

	async function create_page_with_sections(page_data: Omit<Page, 'id' | 'index'>) {
		// Guard the mutation, not just the trigger: a form already open when the
		// mode flips would otherwise still submit.
		if ($read_only) return

		// Get existing siblings and find the max index
		const sibling_pages = all_pages.filter((page) => page.parent === page_data.parent)
		const maxIndex = sibling_pages.length > 0 ? Math.max(...sibling_pages.map((p) => p.index)) : -1
		const new_index = maxIndex + 1

		// Create the page with the next available index
		new_page = Pages.create({
			...page_data,
			index: new_index
		})
	}
</script>

<div class="pages-heading">
	<Dialog.Title class="text-base font-medium">Pages <span class="page-count">{all_pages.length}</span></Dialog.Title>
	{#if onManagePageTypes}<button class="manage-types" data-testid="manage-page-types" onclick={onManagePageTypes}><Icon icon="lucide:layout-template" />Manage page types</button>{/if}
</div>
<p class="pages-description">Open a page to edit its content, or create a new one.</p>
{#if active_page}
	<ul class="grid page-list">
		{#each [homepage, ...root_pages].sort((a, b) => a.index - b.index) as page, i (page.id)}
			<li animate:flip={{ duration: 200 }}>
				<Item {page} {page_slug} active_page_id={!pageState.params.page_type ? active_page.id : null} oncreate={create_page_with_sections} bind:hover_position />
				<div class="drop-indicator-inline" class:active={hover_position === `${page.id}-bottom`}><div></div></div>
				<div class="drop-target-gap" use:gapDropTarget={page}></div>
			</li>
		{/each}
		{#if building_page}
			<li class="building-placeholder">
				<div class="building-page-item">
					<Icon icon="eos-icons:three-dots-loading" />
					<span>Building {building_page_name} Page</span>
				</div>
			</li>
		{/if}

		{#if creating_page && !$read_only}
			<li>
				<PageForm
					oncreate={async (new_page: any) => {
						creating_page = false
						const url_taken = all_pages.some((page) => page?.slug === new_page.slug && page.parent === homepage.id)
						if (url_taken) {
							alert(`That URL is already in use`)
						} else {
							building_page = true
							building_page_name = new_page.name
							await create_page_with_sections({ ...new_page, parent: homepage.id, site: site.id })
						}
					}}
				/>
			</li>
		{:else if !$read_only}
			<li>
				<button class="create-page-btn" onclick={() => (creating_page = true)}>
					<Icon icon="akar-icons:plus" />
					<span>Create page</span>
				</button>
			</li>
		{/if}
	</ul>
{/if}

<style lang="postcss">
	.page-count { font-size: 12px; font-weight: 400; color: #a1a1aa; margin-left: 6px; }
	.pages-description { font-size: 12px; line-height: 1.5; color: #a1a1aa; margin: -4px 0 0; }
	.page-list { min-height: 0; padding: 4px; border: 1px solid #343437; border-radius: 7px; background: #19191b; align-content: start; }
	.create-page-btn { border: 1px solid #3a3a40; margin-top: 6px; min-height: 38px; }
	.create-page-btn:focus-visible { outline: 2px solid #956e51; outline-offset: -2px; }

	.pages-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding-left: 28px; }
	.manage-types { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid #3a3a40; border-radius: 5px; color: #c4c4cc; font-size: 12px; }
	.manage-types:hover { background: #ffffff0a; color: white; }
	.manage-types:focus-visible { outline: 2px solid #956e51; outline-offset: 2px; }

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
	}

	.building-page-item {
		background: #252528;
		border: 1px dashed var(--color-gray-6);
		border-radius: var(--primo-border-radius);
		padding: 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-gray-3);
		font-size: 0.875rem;

		:global(svg) {
			height: 1rem;
			width: 1rem;
		}
	}
</style>
