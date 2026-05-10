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

<Dialog.Header title="Pages ({all_pages.length})" icon="iconoir:multiple-pages" />
{#if active_page}
	<ul class="grid p-2 bg-[var(--primo-color-black)] page-list">
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
	</ul>

	{#if creating_page}
		<div class="p-2 bg-[var(--primo-color-black)]">
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
		</div>
	{:else}
		<div class="p-2 bg-(--primo-color-black)">
			<button class="create-page-btn" onclick={() => (creating_page = true)}>
				<Icon icon="akar-icons:plus" />
				<span>Create Page</span>
			</button>
		</div>
	{/if}
{/if}

<style lang="postcss">
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
		font-size: 0.75;
		width: 100%;
		padding: 0.5rem 1.125rem;
		background: #1a1a1a;
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
		background: #1a1a1a;
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
