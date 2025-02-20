<script>
	import Item from './Item.svelte'
	import Icon from '@iconify/svelte'
	import { onMount } from 'svelte'
	import { get, set } from 'idb-keyval'
	import { createEventDispatcher, getContext } from 'svelte'
	const dispatch = createEventDispatcher()
	import modal from '$lib/builder/stores/app/modal'
	import pages from '$lib/builder/stores/data/pages'
	import page_types from '$lib/builder/stores/data/page_types'
	import active_page from '$lib/builder/stores/data/page'
	import actions from '$lib/builder/actions/pages'
	import { content_editable, validate_url } from '$lib/builder/utilities'
	import PageForm from './PageForm.svelte'
	import MenuPopup from '$lib/builder/ui/Dropdown.svelte'

	let editing_page = $state(false)

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Page | null} [parent]
	 * @property {import('$lib').Page} page
	 * @property {any} [children]
	 * @property {any} active
	 * @property {string[]} [parent_urls]
	 */

	/** @type {Props} */
	let { parent = null, page, children = [], active, parent_urls = [] } = $props()

	const site_id = window.location.pathname.split('/')[1]
	const full_url = parent ? `/${site_id}/${parent_urls.join('/')}/${page.slug}` : `/${site_id}/${page.slug}`

	let showing_children = $state(false)
	let has_children = $derived(children.length > 0)

	get(`page-list-toggle--${page.id}`).then((toggled) => {
		if (toggled !== undefined) showing_children = toggled
	})
	$effect(() => {
		set(`page-list-toggle--${page.id}`, showing_children)
	})

	let creating_page = $state(false)
	let new_page_url = $state('')
	$effect(() => {
		new_page_url = validate_url(new_page_url)
	})

	/**
	 * @param {{ name?: string, url?: string }} args
	 */
	function edit_page(args) {
		actions.update(page.id, args)
	}

	let drag_handle_element = $state()
	let element = $state()
	onMount(async () => {
		const { draggable, dropTargetForElements } = await import('$lib/builder/libraries/pragmatic-drag-and-drop/adapter/element-adapter')
		const { attachClosestEdge, extractClosestEdge } = await import('$lib/builder/libraries/pragmatic-drag-and-drop-hitbox/closest-edge')
		draggable({
			element,
			dragHandle: drag_handle_element,
			getInitialData: () => ({ page })
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
				hover_position = extractClosestEdge(self.data)
			},
			onDragLeave() {
				hover_position = null
			},
			onDrop({ self, source }) {
				const page_dragged_over = self.data.page
				const page_being_dragged = source.data.page
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (page_dragged_over.index === 0) return // can't place above home
				if (closestEdgeOfTarget === 'top') {
					actions.rearrange(page_being_dragged, page_dragged_over.index)
				} else if (closestEdgeOfTarget === 'bottom') {
					actions.rearrange(page_being_dragged, page_dragged_over.index + 1)
				}
				hover_position = null
			}
		})
	})

	let hover_position = $state(null)
</script>

<div class="Item" bind:this={element} class:contains-child={parent}>
	<div class="page-item-container" class:active={page.id === $active_page.id} class:expanded={showing_children && has_children}>
		<div class="left">
			{#if editing_page}
				<div class="details">
					<div
						class="name"
						use:content_editable={{
							autofocus: true,
							on_change: (val) => edit_page({ name: val }),
							on_submit: () => (editing_page = false)
						}}
					>
						{page.name}
					</div>
					{#if page.slug !== ''}
						<div class="url">
							<span>/</span>
							<div
								class="url"
								use:content_editable={{
									on_change: (val) => {
										edit_page({ slug: validate_url(val) })
									},
									on_submit: () => (editing_page = false)
								}}
							>
								{page.slug}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				{@const page_type = $page_types.find((pt) => pt.id === page.page_type)}
				<div class="details">
					{#if $page_types.length > 1}
						<span class="icon" style:background={page_type.color}>
							<Icon icon={page_type.icon} />
						</span>
					{/if}
					<a class:active href={full_url} onclick={() => modal.hide()} class="name">{page.name}</a>
					<span class="url">/{page.slug}</span>
				</div>
			{/if}
			{#if has_children}
				<button class="toggle" class:active={showing_children} onclick={() => (showing_children = !showing_children)} aria-label="Toggle child pages">
					<Icon icon="mdi:chevron-down" />
				</button>
			{/if}
		</div>
		<div class="options">
			<!-- TODO: enable reordering for child pages -->
			{#if !parent}
				<button class="drag-handle" bind:this={drag_handle_element} style:visibility={page.slug === '' ? 'hidden' : 'visible'}>
					<Icon icon="material-symbols:drag-handle" />
				</button>
			{/if}
			<MenuPopup
				icon="carbon:overflow-menu-vertical"
				options={[
					...(page.slug !== '' && !creating_page
						? [
								{
									label: `Create Child Page`,
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
						}
					},
					...(page.slug !== ''
						? [
								{
									label: 'Delete',
									icon: 'ic:outline-delete',
									on_click: () => dispatch('delete', page)
								}
							]
						: [])
				]}
			/>
		</div>
	</div>

	{#if showing_children && has_children}
		<ul class="page-list child">
			{#each children as subpage}
				{@const subchildren = $pages.filter((p) => p.parent === subpage.id)}
				<Item parent={page} page={subpage} parent_urls={[...parent_urls, page.slug]} children={subchildren} active={$active_page.id === subpage.id} on:delete on:create />
			{/each}
		</ul>
	{/if}

	{#if creating_page}
		<div style="border-left: 0.5rem solid #111;">
			<PageForm
				{page}
				parent={page.id}
				on:create={({ detail: new_page }) => {
					creating_page = false
					showing_children = true
					dispatch('create', { page: new_page, index: children.length })
				}}
			/>
		</div>
	{:else if showing_children && has_children}
		<button class="create-page" onclick={() => (creating_page = true)}>
			<Icon icon="akar-icons:plus" />
			<span>Create Child Page</span>
		</button>
	{/if}

	<hr class:highlight={hover_position === 'bottom'} />
</div>

<style lang="postcss">
	button.create-page {
		padding: 0.5rem;
		background: #1f1f1f;
		margin-left: 0.5rem;
		width: calc(100% - 0.5rem);
		font-size: 0.75rem;
		border-bottom-left-radius: var(--primo-border-radius);
		border-bottom-right-radius: var(--primo-border-radius);
		display: flex;
		justify-content: center;
		gap: 0.25rem;
		align-items: center;
		transition: 0.1s;

		&:hover {
			box-shadow: var(--primo-ring-thin);
		}
	}
	.drag-handle {
		cursor: grab;
	}
	.Item {
		/* padding-bottom: 0.5rem; */

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
	hr {
		border: 3px solid transparent;

		&.highlight {
			border-color: var(--weave-primary-color);
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
			/* outline: 1px solid var(--weave-primary-color); */

			a {
				color: var(--weave-primary-color);
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
				gap: 1rem;
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
				}

				div.name,
				div.url {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					width: 100%;
					color: var(--weave-primary-color);

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
					color: var(--weave-primary-color);
				}

				&.active {
					transform: scaleY(-1);
				}
			}
		}

		.options {
			display: flex;
			gap: 0.75rem;
		}
	}

	ul.page-list {
		margin: 0 1rem 1rem 1rem;
		/* background: #323334; */
		border-radius: var(--primo-border-radius);

		&.child {
			font-size: 0.875rem;
			margin: 0;
			/* border-top: 1px solid #222; */
			/* margin-left: 1rem; */
			border-top-right-radius: 0;
			border-top-left-radius: 0;
		}

		&.child:not(.entry) {
			margin-left: 0.5rem;
		}
	}
</style>
