<script lang="ts">
	import Item from './Item.svelte'
	import Icon from '@iconify/svelte'
	import { onMount, tick } from 'svelte'
	import { get, set } from 'idb-keyval'
	import { slide, fade } from 'svelte/transition'
	import { flip } from 'svelte/animate'
	import { content_editable, validate_url } from '$lib/builder/utilities'
	import PageForm from './PageForm.svelte'
	import MenuPopup from '$lib/builder/ui/Dropdown.svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Button } from '$lib/components/ui/button'
	import { page as pageState } from '$app/state'
	import { toast } from 'svelte-sonner'
	import { Pages, PageTypes, Sites } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { site_context } from '$lib/builder/stores/context'
	import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import type { Page } from '$lib/common/models/Page'
	import { build_cms_page_url } from '$lib/pages'
	import { goto } from '$app/navigation'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { self as selfManager } from '$lib/pocketbase/managers'
	import { getUserActivity } from '$lib/UserActivity.svelte'

	let editing_page = $state(false)

	/** @type {Props} */
	let {
		parent,
		page,
		oncreate,
		page_slug,
		active_page_id,
		hover_position = $bindable(null)
	}: {
		parent?: ObjectOf<typeof Pages>
		page: ObjectOf<typeof Pages>
		oncreate: (new_page: Omit<Page, 'id' | 'index'>) => Promise<void>
		page_slug: string
		active_page_id?: string
		hover_position?: string | null
	} = $props()

	// Get site from context (preferred) or fallback to hostname lookup
	const { value: site } = site_context.get()
	const homepage = $derived(site.homepage())

	const full_url = $derived(build_cms_page_url(page, pageState.url))
	const allPages = $derived(site?.pages() ?? [])
	const page_type = $derived(PageTypes.one(page.page_type))
	const related_activities = $derived(getUserActivity({ filter: (activity) => activity.page?.id === page.id }))

	let showing_children = $state(false)
	let children = $derived((page.children() ?? []).sort((a, b) => b.index - a.index))
	let has_children = $derived(children.length > 0 && page.slug !== '')
	let has_toggled = $state(false)
	const active = $derived(page.id === active_page_id)

	// Local hover_position for this level's children (separate from parent's hover_position)
	// This is used to track hover position for subpages when this Item has children
	let children_hover_position = $state<string | null>(null)

	get(`page-list-toggle--${page.id}`).then((toggled) => {
		if (toggled !== undefined) showing_children = toggled
	})
	$effect(() => {
		set(`page-list-toggle--${page.id}`, showing_children)
	})

	let creating_page = $state(false)
	let delete_warning_dialog = $state(false)
	let pages_to_delete = $state<any[]>([])
	let pending_delete = $state<(() => Promise<void>) | null>(null)

	// Function to get all descendants (children, grandchildren, etc.) of a page
	function getAllDescendants(pageId: string): any[] {
		const descendants: any[] = []
		const queue = [pageId]

		while (queue.length > 0) {
			const currentId = queue.shift()!
			const children = allPages.filter((p) => p.parent === currentId)

			for (const child of children) {
				descendants.push(child)
				queue.push(child.id)
			}
		}

		return descendants
	}

	let drag_handle_element = $state()
	let element = $state()
	onMount(async () => {
		draggable({
			element,
			dragHandle: drag_handle_element,
			getInitialData: () => ({ page }),
			onDragStart: () => {
				is_dragging = true
			},
			onDrop: () => {
				is_dragging = false
			}
		})
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ page },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDrag({ self, source }) {
				// Only show indicators if dragging within the same parent level
				const page_being_dragged = source.data.page as ObjectOf<typeof Pages>
				const same_parent = page.parent === page_being_dragged.parent

				if (!same_parent) {
					hover_position = null
					return
				}

				// Dragging - adjust indicator according to drag position
				const edge = extractClosestEdge(self.data)
				if (edge === 'bottom') {
					// Set hover position to show indicator below this item
					// For subpages, hover_position prop is passed from parent's children_hover_position
					// Since hover_position is $bindable, setting it updates the parent's value
					hover_position = `${page.id}-bottom`
				} else if (edge === 'top') {
					// For top edge, we want to show the indicator above this item
					// which is the bottom of the previous item
					if (page.index === 0 && page.parent === '') {
						hover_position = null // Can't drop above home page
					} else if (page.index === 0 && page.parent) {
						// First child in a nested level - show at top of children list
						hover_position = `${page.parent}-children-top`
					} else {
						// Find the previous sibling
						const siblings = allPages.filter((p) => p.parent === page.parent).sort((a, b) => a.index - b.index)
						const prevIndex = siblings.findIndex((p) => p.id === page.id) - 1
						if (prevIndex >= 0) {
							hover_position = `${siblings[prevIndex].id}-bottom`
						}
					}
				}
			},
			onDragLeave() {
				hover_position = null
			},
			onDrop({ self, source }) {
				// Dropped - adjust index of moved page and siblings pages
				const page_dragged_over = self.data.page as ObjectOf<typeof Pages>
				const page_being_dragged = source.data.page as ObjectOf<typeof Pages>
				const closestEdgeOfTarget = extractClosestEdge(self.data)

				// Don't allow dragging onto itself
				if (page_dragged_over.id === page_being_dragged.id) {
					hover_position = null
					return
				}

				// Don't allow placing above home page
				if (closestEdgeOfTarget === 'top' && page_dragged_over.index === 0 && page_dragged_over.parent === '') {
					hover_position = null
					return
				}

				// Check if dragging between different parent levels
				const same_parent = page_dragged_over.parent === page_being_dragged.parent

				// Get all siblings (pages with same parent as the target)
				const siblings = allPages.filter((p) => p.parent === page_dragged_over.parent).sort((a, b) => a.index - b.index)

				const old_index = page_being_dragged.index
				let target_index

				if (closestEdgeOfTarget === 'top') {
					target_index = page_dragged_over.index
				} else if (closestEdgeOfTarget === 'bottom') {
					target_index = page_dragged_over.index + 1
				}

				hover_position = null

				// Only allow reordering within same parent
				if (same_parent) {
					// Delay the actual updates to prevent jerky animations
					requestAnimationFrame(() => {
						// Adjust target index if we're moving from before to after in the list
						let final_index = target_index
						if (old_index < target_index) {
							final_index = target_index - 1
						}

						// Don't do anything if position hasn't changed
						if (old_index === final_index) {
							return
						}

						// Reindex all affected siblings
						for (let i = 0; i < siblings.length; i++) {
							const sibling = siblings[i]
							let new_index = sibling.index

							if (sibling.id === page_being_dragged.id) {
								new_index = final_index
							} else if (old_index < final_index) {
								// Moving item down - shift others up
								if (sibling.index > old_index && sibling.index <= final_index) {
									new_index = sibling.index - 1
								}
							} else {
								// Moving item up - shift others down
								if (sibling.index >= final_index && sibling.index < old_index) {
									new_index = sibling.index + 1
								}
							}

							if (new_index !== sibling.index) {
								Pages.update(sibling.id, { index: new_index })
							}
						}

						selfManager.commit()
					})
				}
			}
		})
	})

	let is_dragging = $state(false)

	let name_input_el
</script>

<div class="Item" bind:this={element} class:contains-child={parent} class:dragging={is_dragging}>
	<div class="page-item-container" class:active class:expanded={showing_children && has_children}>
		<div class="left">
			{#if editing_page}
				<div class="details">
					<div
						class="name"
						bind:this={name_input_el}
						use:content_editable={{
							on_change: (val) => {},
							on_submit: (val) => {
								Pages.update(page.id, { name: val })
								selfManager.commit()
								editing_page = false
							}
						}}
					>
						{page.name}
					</div>
				</div>
			{:else}
				<div class="details">
					<span class="icon" style:background={page_type?.color}>
						<Icon icon={page_type?.icon} />
					</span>
					<a class:active href={full_url?.href} onclick={() => {}} class="name">{page.name}</a>
					<span class="url">/{page.slug}</span>
				</div>
				<div class="flex -space-x-4">
					{#each related_activities as [{ user, user_avatar }]}
						<Avatar.Root class="ring-background ring-2 size-5 ml-4">
							{#if user_avatar}
								<Avatar.Image src={user_avatar} alt={user.name || user.email} class="object-cover object-center" />
							{/if}
							<Avatar.Fallback>{(user.name || user.email).slice(0, 2).toUpperCase()}</Avatar.Fallback>
						</Avatar.Root>
					{/each}
				</div>
			{/if}
			{#if has_children}
				<button
					class="toggle"
					class:active={showing_children}
					onclick={() => {
						showing_children = !showing_children
						has_toggled = true
					}}
					aria-label="Toggle child pages"
				>
					<Icon icon="mdi:chevron-down" />
				</button>
			{/if}
		</div>
		<div class="options">
			{#if has_children && page.id !== homepage?.id}
				<button class="add-child-btn" onclick={() => (creating_page = true)} aria-label="Create Subpage">
					<Icon icon="akar-icons:plus" />
					<span>Create Subpage ({children.length})</span>
				</button>
			{/if}
			<button class="drag-handle" bind:this={drag_handle_element} style:visibility={page.slug === '' ? 'hidden' : 'visible'}>
				<Icon icon="material-symbols:drag-handle" />
			</button>
			<MenuPopup
				icon="carbon:overflow-menu-vertical"
				options={[
					...(!has_children && !creating_page && page.id !== homepage?.id
						? [
								{
									label: `Create Subpage`,
									icon: 'akar-icons:plus',
									on_click: () => {
										creating_page = true
									}
								}
							]
						: []),
					{
						label: 'Change Name',
						icon: 'clarity:edit-solid',
						on_click: () => {
							editing_page = !editing_page
							tick().then(() => {
								name_input_el.focus()
							})
						}
					},
					...(!!page.parent
						? [
								{
									label: 'Delete',
									icon: 'ic:outline-delete',
									danger: true,
									on_click: async () => {
										const descendants = getAllDescendants(page.id)

										if (descendants.length > 0) {
											// Show warning dialog for pages with children
											pages_to_delete = [page, ...descendants]
											pending_delete = async () => {
												const parent_id = page.parent

												// Delete the page and all descendants
												Pages.delete(page.id)
												descendants.forEach((desc) => Pages.delete(desc.id))

												// Reindex remaining sibling pages
												const sibling_pages = allPages.filter((p) => p.parent === parent_id && p.id !== page.id && !descendants.some((d) => d.id === p.id)).sort((a, b) => a.index - b.index)

												sibling_pages.forEach((sibling_page, i) => {
													const index = parent_id === homepage?.id ? i + 1 : i
													Pages.update(sibling_page.id, { index })
												})

												await selfManager.commit()

												toast.success(descendants.length > 0 ? `Deleted "${page.name}" and ${descendants.length} child page(s)` : `Deleted "${page.name}"`)

												// If the deleted page was the one open, navigate to homepage
												try {
													if (page_slug === page.slug) {
														const home_url = build_cms_page_url(homepage, pageState.url)
														if (home_url) await goto(home_url, { replaceState: true })
													}
												} catch (e) {
													console.warn('Navigation after delete failed', e)
												}
											}
											delete_warning_dialog = true
										} else {
											// Direct delete for pages without children
											const parent_id = page.parent
											Pages.delete(page.id)

											// Reindex remaining sibling pages
											const sibling_pages = allPages.filter((p) => p.parent === parent_id && p.id !== page.id).sort((a, b) => a.index - b.index)

											sibling_pages.forEach((sibling_page, i) => {
												const index = parent_id === homepage?.id ? i + 1 : i
												Pages.update(sibling_page.id, { index })
											})

											await selfManager.commit()

											toast.success(`Deleted "${page.name}"`)

											// If the deleted page was the one open, navigate to homepage
											try {
												if (page_slug === page.slug) {
													const home_url = build_cms_page_url(homepage, pageState.url)
													if (home_url) await goto(home_url, { replaceState: true })
												}
											} catch (e) {
												console.warn('Navigation after delete failed', e)
											}
										}
									}
								}
							]
						: [])
				]}
			/>
		</div>
	</div>

	{#if creating_page}
		<div style="border-left: 0.5rem solid #111;" transition:slide={{ duration: 200 }}>
			<PageForm
				parent={page}
				oncreate={async (new_page: Omit<Page, 'id' | 'parent' | 'site' | 'index'>) => {
					creating_page = false
					showing_children = true
					const url_taken = allPages.some((p) => p?.slug === new_page.slug && p.parent === page.id)
					if (url_taken) {
						alert(`That URL is already in use`)
					} else {
						// Pass the correct parent and site IDs
						const site_id = site?.id || page.site
						await oncreate({ ...new_page, parent: page.id, site: site_id })
					}
				}}
			/>
		</div>
	{/if}

	{#if showing_children && has_children}
		<div class="children-container">
			<div class="drop-indicator-top" class:active={children_hover_position === `${page.id}-children-top`}><div></div></div>
			<ul class="page-list child" transition:slide={{ duration: has_toggled ? 100 : 0 }}>
				{#each children as subpage (subpage.id)}
					<li animate:flip={{ duration: 200 }} class="subpage-item">
						<Item parent={page} page={subpage} active={subpage.id === active_page_id} {page_slug} {active_page_id} {oncreate} bind:hover_position={children_hover_position} on:delete on:create />
						<div class="drop-indicator-inline" class:active={children_hover_position === `${subpage.id}-bottom`}><div></div></div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<!-- Delete Warning Dialog -->
<Dialog.Root bind:open={delete_warning_dialog}>
	<Dialog.Content class="sm:max-w-[500px] p-6 pt-12">
		<div class="mb-6">
			<div class="flex items-center gap-3 mb-4">
				<div class="p-2 rounded-full bg-red-500/10">
					<Icon icon="mdi:alert-circle" class="w-6 h-6 text-red-500" />
				</div>
				<h2 class="text-lg font-semibold text-red-500">Delete Page and Children</h2>
			</div>
			<p class="text-sm text-gray-400 leading-relaxed mb-4">
				This page has {pages_to_delete.length - 1} child page(s) that will also be permanently deleted. This action cannot be undone.
			</p>
			<div class="bg-gray-900/50 rounded-lg p-3 max-h-40 overflow-y-auto">
				<p class="text-xs text-gray-500 mb-2 font-medium">Pages to be deleted:</p>
				<ul class="text-sm space-y-1">
					{#each pages_to_delete as pageToDelete}
						<li class="flex items-center gap-2 text-gray-300">
							<Icon icon="mdi:file-document" class="w-4 h-4 text-gray-500 flex-shrink-0" />
							{pageToDelete.name}
							<span class="text-gray-500 text-xs">/{pageToDelete.slug}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
		<div class="flex gap-2 justify-end">
			<Button
				variant="outline"
				onclick={() => {
					delete_warning_dialog = false
					pages_to_delete = []
					pending_delete = null
				}}
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				onclick={async () => {
					if (pending_delete) {
						await pending_delete()
					}
					delete_warning_dialog = false
					pages_to_delete = []
					pending_delete = null
				}}
			>
				<Icon icon="mdi:delete" class="w-4 h-4 mr-1" />
				Delete All
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style lang="postcss">
	.drag-handle {
		cursor: grab;
	}
	.Item {
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: visible;
		/* gap: 4px; */
		/* padding-bottom: 0.5rem; */

		&.dragging {
			opacity: 0.5;
			transform: scale(0.98);
			transition:
				transform 0.2s ease,
				opacity 0.2s ease;
		}

		&.contains-child {
			.page-item-container {
				padding-block: 0.5rem;
				border-radius: 0;
			}

			.details {
				gap: 0.75rem;
			}

			.icon {
				font-size: 10px !important;
				padding: 4px !important;
				aspect-ratio: 1;
				align-self: center;
			}

			hr {
				border-width: 1px !important;
				border-color: #1a1a1a !important;
			}
		}
	}

	.page-item-container {
		display: flex;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		border-bottom-left-radius: 0.25rem;
		background: #1a1a1a;
		border-radius: var(--primo-border-radius);
		&.expanded {
			border-bottom-right-radius: 0;
			border-bottom: 1px solid var(--color-gray-9);
		}

		&.active {
			/* background: #222; */
			border-bottom-right-radius: 0;
			/* outline: 1px solid var(--primo-primary-color); */

			a {
				color: var(--primo-primary-color);
			}
		}

		.left {
			display: flex;
			align-items: center;
			gap: 0.5rem;

			.details {
				font-weight: 400;
				line-height: 1.5rem;
				display: grid;
				grid-template-columns: auto auto 1fr;
				place-items: center;
				gap: 0.75rem;
				color: var(--color-gray-1);

				.icon {
					font-size: 0.75rem;
					padding: 6px;
					border-radius: 1rem;
					display: flex;
					justify-content: center;
					align-items: center;
				}

				a.name {
					font-size: 0.875rem;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					border-bottom: 1px solid transparent;
					margin-bottom: -1px;
					transition: 0.1s;
					&:hover {
						border-color: white;
					}
				}

				.url {
					display: flex;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					font-weight: 400;
					color: var(--color-gray-5);
					display: inline-block; /* This is key for spans */
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				div.name,
				div.url {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					width: 100%;
					color: var(--primo-primary-color);

					span {
						color: var(--color-gray-5);
					}

					&:focus {
						outline: none;
					}
				}
			}

			.toggle {
				padding: 0 0.5rem;
				transition: 0.1s color;
				font-size: 1.5rem;

				&:hover {
					color: var(--primo-primary-color);
				}

				&.active {
					transform: scaleY(-1);
				}
			}
		}

		.options {
			display: flex;
			gap: 0.75rem;

			.add-child-btn {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				padding: 0.25rem 0.5rem;
				background: var(--color-gray-9);
				border-radius: 0.25rem;
				font-size: 0.75rem;
				color: var(--color-gray-3);
				transition: 0.1s;

				&:hover {
					background: var(--color-gray-8);
					color: var(--primo-primary-color);
				}

				span {
					white-space: nowrap;
				}
			}
		}
	}

	.children-container {
		position: relative;
		margin-top: 2px;
	}

	ul.page-list {
		margin: 0 1rem 1rem 1rem;
		/* background: #323334; */
		border-radius: var(--primo-border-radius);
		position: relative;

		&.child {
			font-size: 0.875rem;
			margin: 0;
			/* border-top: 1px solid #222; */
			/* margin-left: 1rem; */
			border-top-right-radius: 0;
			border-top-left-radius: 0;
			position: relative;

			> li.subpage-item {
				position: relative;
				overflow: visible;
			}
		}

		&.child:not(.entry) {
			margin-left: 0.5rem;
		}
	}

	.drop-indicator-inline {
		height: 4px;
		display: flex;
		align-items: center;
		padding: 0 8px;
		position: absolute;
		bottom: -6px;
		left: 0;
		right: 0;
		z-index: 10;
		pointer-events: none;

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

	.drop-indicator-top {
		height: 4px;
		display: flex;
		align-items: center;
		padding: 0 8px;
		position: absolute;
		top: -2px;
		left: 0.5rem;
		right: 0;
		z-index: 100;

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
			box-shadow: 0 0 8px var(--primo-primary-color);
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
</style>
