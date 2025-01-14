<script>
	// @ts-nocheck

	import _ from 'lodash-es'
	import { tick, onDestroy } from 'svelte'
	import { fade } from 'svelte/transition'
	import { flip } from 'svelte/animate'
	import UI from '$lib/builder/ui'
	import ComponentNode from './Layout/ComponentNode.svelte'
	import BlockToolbar from './Layout/BlockToolbar.svelte'
	import LockedOverlay from './Layout/LockedOverlay.svelte'
	import DropIndicator from './Layout/DropIndicator.svelte'
	import { isEqual, cloneDeep } from 'lodash-es'
	import { code as siteCode, design as siteDesign } from '$lib/builder/stores/data/site'
	import { locale, locked_blocks, page_loaded, dragging_symbol } from '$lib/builder/stores/app/misc'
	import { add_section_to_palette, delete_section_from_palette, move_section } from '$lib/builder/actions/sections'
	import { update_section } from '$lib/builder/actions/sections'
	import modal from '$lib/builder/stores/app/modal'
	import active_site from '$lib/builder/stores/data/site'
	import active_page from '$lib/builder/stores/data/page'
	import sections from '$lib/builder/stores/data/sections'
	import symbols from '$lib/builder/stores/data/symbols'
	import { processCode, createUniqueID } from '$lib/builder/utils'
	import { get_page_data } from '$lib/builder/stores/helpers'
	import { site_design_css } from '$lib/builder/code_generators.js'
	import { dropTargetForElements } from '$lib/builder/libraries/pragmatic-drag-and-drop/entry-point/element/adapter.js'
	import { attachClosestEdge, extractClosestEdge } from '$lib/builder/libraries/pragmatic-drag-and-drop-hitbox/closest-edge.js'
	import { realtimeChanged, broadcastChanged } from '$lib/builder/database'
	import { page as page_store } from '$app/stores'
	import { beforeNavigate } from '$app/navigation'
	import { hydrate_active_page } from '$lib/builder/stores/hydration'

	let { page } = $props()

	// Fade in page when all components mounted
	let page_mounted = $state(false)

	// detect when all sections are mounted to fade in page
	let sections_mounted = $state(0)

	beforeNavigate(() => {
		page_mounted = false
		sections_mounted = 0
	})

	const instance_key = createUniqueID()

	async function lock_block(block_id) {
		realtimeChanged({
			instance: instance_key,
			user: $page_store.data.user,
			data: {
				active_block: block_id
			}
		})
	}

	function unlock_block() {
		realtimeChanged({
			instance: instance_key,
			user: $page_store.data.user,
			data: {
				active_block: null
			}
		})
	}

	let hovered_section = $state(null)

	let page_el = $state()
	let hovered_block_el = $state()

	////////////////////////////
	// BLOCK TOOLBAR ///////////
	////////////////////////////

	let block_toolbar_element = $state()
	let showing_block_toolbar = $state(false)

	async function show_block_toolbar() {
		if (!showing_block_toolbar) {
			showing_block_toolbar = true
			await tick()
			position_block_toolbar()
			page_el.addEventListener('scroll', position_block_toolbar)
		}
	}

	async function position_block_toolbar() {
		await tick()
		if (!hovered_block_el || !block_toolbar_element) return
		hovered_block_el.appendChild(block_toolbar_element)
		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const toolbar_height = 45

		// Keep toolbar within viewport bounds
		const toolbar_top = Math.max(toolbar_height, Math.min(top, window.innerHeight - toolbar_height))
		const toolbar_bottom = Math.max(0, window.innerHeight - bottom)

		block_toolbar_element.style.position = 'fixed'
		block_toolbar_element.style.top = `${toolbar_top}px`

		block_toolbar_element.style.bottom = `${toolbar_bottom}px`
		block_toolbar_element.style.left = `${left}px`
		block_toolbar_element.style.right = `${window.innerWidth - right}px`
	}

	async function hide_block_toolbar() {
		showing_block_toolbar = false
		window.removeEventListener('scroll', position_block_toolbar)
		await tick()
	}

	////////////////////////////
	// DROP INDICATOR //////////
	////////////////////////////

	let drop_indicator_element = $state()
	let showing_drop_indicator = $state(false)

	async function show_drop_indicator() {
		if (!showing_drop_indicator) {
			showing_drop_indicator = true
			await tick()
			page_el.addEventListener('scroll', position_drop_indicator)
		}
	}

	async function position_drop_indicator() {
		if (!hovered_block_el || !drop_indicator_element) return
		// await tick()
		hovered_block_el.appendChild(drop_indicator_element)
		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const block_positions = {
			top: (top <= 41 ? 41 : top) + window.scrollY,
			bottom: bottom >= window.innerHeight ? 0 : window.innerHeight - bottom,
			left,
			right: window.innerWidth - right - window.scrollX
		}
		drop_indicator_element.style.left = `${block_positions.left}px`
		drop_indicator_element.style.right = `${block_positions.right}px`

		// surround placeholder palette

		if (dragging.position === 'top' || palette_sections.length === 0) {
			drop_indicator_element.style.top = `${block_positions.top}px`
		} else {
			drop_indicator_element.style.top = `initial`
		}

		if (dragging.position === 'bottom' || palette_sections.length === 0) {
			drop_indicator_element.style.bottom = `${block_positions.bottom}px`
		} else {
			drop_indicator_element.style.bottom = `initial`
		}
	}

	function hide_drop_indicator() {
		showing_drop_indicator = false
		page_el.removeEventListener('scroll', position_drop_indicator)
	}

	////////////////////////////

	function edit_section(section_id, showIDE = false) {
		lock_block(section_id)
		const section = $sections.find((s) => s.id === section_id) // get updated block (necessary if actively editing on-page)
		modal.show(
			'SECTION_EDITOR',
			{
				component: section,
				tab: showIDE ? 'code' : 'content',
				header: {
					title: `Edit Block`,
					icon: showIDE ? 'fas fa-code' : 'fas fa-edit',
					onclose: () => {
						unlock_block()
					},
					button: {
						icon: 'fas fa-check',
						label: 'Save',
						onclick: (updated_data, changes) => {
							unlock_block()
							broadcastChanged({ page_id: page.id })
							modal.hide()
							update_section(section_id, {
								updated_data,
								changes
							})
						}
					}
				}
			},
			{
				showSwitch: true,
				disabledBgClose: true
			}
		)
	}

	let moving = $state(false) // workaround to prevent block toolbar from showing when moving blocks

	let dragging = {
		id: null,
		position: null
	}
	function reset_drag() {
		dragging = {
			id: null,
			position: null
		}
		dragging_over_section = false
		hide_drop_indicator()
	}

	let dragging_over_section = $state(false)

	function drag_fallback(element) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{},
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			async onDrag({ self, source }) {
				if (dragging_over_section) return // prevent double-adding block
				const last_section_id = palette_sections[palette_sections.length - 1]?.id
				if (!last_section_id) return
				hovered_block_el = page_el.querySelector(`[data-section="${last_section_id}"]`)

				if (!showing_drop_indicator) {
					await show_drop_indicator()
				}
				position_drop_indicator()
				if (dragging.id !== last_section_id || dragging.position !== extractClosestEdge(self.data)) {
					dragging = {
						id: last_section_id,
						position: extractClosestEdge(self.data)
					}
				}
			},
			onDragLeave() {
				reset_drag()
			},
			async onDrop({ source }) {
				if (dragging_over_section) return // prevent double-adding block
				const block_being_dragged = source.data.block
				const new_section_id = await add_section_to_palette({
					palette_id: palette_section.id,
					symbol: block_being_dragged,
					position: palette_sections.length
				})
				const new_section_el = page_el.querySelector(`[data-section="${new_section_id}"]`)
				new_section_el.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
					inline: 'center'
				})
				reset_drag()
			}
		})
	}

	function drag_item(element, section) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ section },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			async onDrag({ self, source }) {
				hovered_block_el = self.element
				if (!showing_drop_indicator) {
					await show_drop_indicator()
				}
				position_drop_indicator()
				if (dragging.id !== self.data.section.id || dragging.position !== extractClosestEdge(self.data)) {
					dragging = {
						id: self.data.section.id,
						position: extractClosestEdge(self.data)
					}
				}
			},
			onDragEnter() {
				dragging_over_section = true
			},
			onDragLeave() {
				reset_drag()
			},
			async onDrop({ self, source }) {
				const is_first_pallete_section = palette_sections.length === 0
				const section_dragged_over_index = $sections.find((s) => s.id === self.data.section.id).index
				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (closestEdgeOfTarget === 'top') {
					const new_section_id = await add_section_to_palette({
						palette_id: palette_section.id,
						symbol: block_being_dragged,
						position: is_first_pallete_section ? 0 : section_dragged_over_index
					})
					const new_section_el = page_el.querySelector(`[data-section="${new_section_id}"]`)
					new_section_el.scrollIntoView({
						behavior: 'smooth',
						block: 'center',
						inline: 'center'
					})
				} else if (closestEdgeOfTarget === 'bottom') {
					const new_section_id = await add_section_to_palette({
						palette_id: palette_section.id,
						symbol: block_being_dragged,
						position: is_first_pallete_section ? 0 : section_dragged_over_index + 1
					})
					const new_section_el = page_el.querySelector(`[data-section="${new_section_id}"]`)
					new_section_el.scrollIntoView({
						behavior: 'smooth',
						block: 'center',
						inline: 'center'
					})
				}
				reset_drag()
				$dragging_symbol = false
			}
		})
	}

	$effect.pre(() => {
		hydrate_active_page(page)
	})

	let page_is_empty = $derived($sections.length === 1) // just has palette
	let non_palette_sections = $derived($sections.filter((s) => s.palette || s.master?.symbol))
	$effect(() => {
		if (sections_mounted === non_palette_sections.length && sections_mounted !== 0) {
			page_mounted = true
		} else if (page_is_empty) {
			page_mounted = true
		}
	})
	let palette_section = $derived($sections.find((s) => !s.symbol && !s.master?.symbol))
	let block_toolbar_on_locked_block = $derived($locked_blocks.find((b) => b.block_id === hovered_section?.id))
	$effect(() => {
		if (block_toolbar_on_locked_block) hide_block_toolbar()
	})
	// get position of palette from page.page_type.sections
	// on drag, display palette drop zone
	// only respond to hover within palette drop zone

	let top_level_sections = $derived($sections.filter((s) => !s.palette))
	let palette_sections = $derived($sections.filter((s) => s.palette))
</script>

<!-- Loading Spinner -->
{#if !page_mounted && $sections.length > 1}
	<div class="spinner" style="--Spinner-color: var(--color-gray-7);">
		<UI.Spinner variant="loop" />
	</div>
{/if}

<!-- Drop Indicator -->
{#if showing_drop_indicator}
	<DropIndicator bind:node={drop_indicator_element} />
{/if}

<!-- Block Buttons -->
{#if showing_block_toolbar && !block_toolbar_on_locked_block}
	<BlockToolbar
		bind:node={block_toolbar_element}
		id={hovered_section.id}
		i={hovered_section.index}
		is_instance_block={hovered_section.master}
		is_last={hovered_section.is_last}
		on:delete={async () => {
			hide_block_toolbar()
			delete_section_from_palette(hovered_section.id)
		}}
		on:edit-code={() => edit_section(hovered_section.id, true)}
		on:edit-content={() => edit_section(hovered_section.id)}
		on:moveUp={async () => {
			moving = true
			hide_block_toolbar()
			await move_section(hovered_section, hovered_section.index - 1)
			setTimeout(() => {
				moving = false
			}, 300)
		}}
		on:moveDown={async () => {
			moving = true
			hide_block_toolbar()
			await move_section(hovered_section, hovered_section.index + 1)
			setTimeout(() => {
				moving = false
			}, 300)
		}}
	/>
{/if}

<!-- Page Blocks -->
<main id="Page" bind:this={page_el} class:fadein={$page_loaded && page_mounted} class:dragging={$dragging_symbol} lang={$locale} use:drag_fallback>
	{#each top_level_sections.sort((a, b) => a.master.index - b.master.index) as section (section.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_mouse_events_have_key_events -->
		{@const is_palette = !section.symbol && !section.master?.symbol}
		{@const show_block_toolbar_on_hover = !moving && !(is_palette && palette_sections.length === 0)}
		{@const has_page_type_symbols = $symbols.some((s) => s.page_types.includes($active_page.page_type.id))}
		{@const should_show_palette = has_page_type_symbols || palette_sections.length > 0}
		{#if is_palette && should_show_palette}
			<div data-section={section.id} data-type="palette" class:empty={palette_sections.length === 0}>
				{#if palette_sections.length > 0}
					{#each palette_sections.sort((a, b) => a.index - b.index) as section (section.id)}
						{@const block = $symbols.find((symbol) => symbol.id === section.symbol)}
						{@const locked = $locked_blocks.find((b) => b.block_id === section.id)}
						{@const in_current_tab = locked?.instance === instance_key}
						<div
							role="presentation"
							data-section={section.id}
							data-symbol={block.id}
							onmousemove={show_block_toolbar}
							onmouseenter={async ({ target }) => {
								hovered_section = {
									...section,
									is_last: section.index === palette_sections.length - 1
								}
								hovered_block_el = target
								if (show_block_toolbar_on_hover) show_block_toolbar()
							}}
							onmouseleave={hide_block_toolbar}
							animate:flip={{ duration: 100 }}
							use:drag_item={section}
						>
							{#if locked && !in_current_tab}
								<LockedOverlay {locked} />
							{/if}
							<ComponentNode
								{block}
								{section}
								on:lock={() => lock_block(section.id)}
								on:unlock={() => unlock_block()}
								on:mount={() => sections_mounted++}
								on:resize={() => {
									if (showing_block_toolbar) {
										position_block_toolbar()
									}
								}}
							/>
						</div>
					{/each}
				{:else}
					<div
						role="presentation"
						class="empty-state"
						class:page_is_empty
						use:drag_item={section}
						onmouseenter={async ({ target }) => {
							hovered_block_el = target
						}}
						onmouseleave={() => {
							hovered_block_el = null
						}}
					>
						Drag blocks here to add them to the page
					</div>
				{/if}
			</div>
		{:else if !is_palette}
			{@const block = $symbols.find((block) => block.id === section.master.symbol)}
			{@const locked = $locked_blocks.find((b) => b.block_id === section.id)}
			{@const in_current_tab = locked?.instance === instance_key}
			<div
				role="presentation"
				data-section={section.id}
				data-type="static"
				onmousemove={show_block_toolbar}
				onmouseenter={async ({ target }) => {
					hovered_section = {
						...section,
						is_last: section.index === top_level_sections.length - 1
					}
					hovered_block_el = target
					show_block_toolbar()
				}}
				onmouseleave={hide_block_toolbar}
			>
				{#if locked && !in_current_tab}
					<LockedOverlay {locked} />
				{/if}
				<ComponentNode
					{block}
					{section}
					on:lock={() => lock_block(section.id)}
					on:unlock={() => unlock_block()}
					on:mount={() => sections_mounted++}
					on:resize={() => {
						if (showing_block_toolbar) {
							position_block_toolbar()
						}
					}}
				/>
			</div>
		{:else if is_palette && !should_show_palette}
			<div class="empty-state" style="height: 100%">
				<span>Add Blocks to the Page Type to make them available on this page.</span>
				<br />
				<a class="button" href="{$active_site.id}/page-type--{$active_page.page_type.id}">Edit Page Type</a>
			</div>
		{/if}
	{/each}
</main>

<style lang="postcss">
	[data-section] {
		overflow: hidden;
		position: relative;
		min-height: 4rem;
		line-height: 0;
	}
	[data-type='palette'] {
		.empty-state {
			background: var(--color-gray-1);
			display: flex;
			justify-content: center;
			padding-block: 5rem;
			border: 1px dotted;
			&.page_is_empty {
				height: 100%;
			}
		}
	}
	.spinner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		/* height: 100vh; */
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 5;
		--Spinner-font-size: 3rem;
		--Spinner-color: var(--primo-color-brand);
		--Spinner-color-opaque: rgba(248, 68, 73, 0.2);
	}
	main#Page {
		transition: 0.2s opacity;
		opacity: 0;
		border-top: 0;
		height: 100%;
		/* padding-top: 42px; */
		overflow: auto;
		box-sizing: border-box;
	}
	main.dragging :global(iframe) {
		pointer-events: none !important;
	}
	main#Page.fadein {
		opacity: 1;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: var(--color-gray-4);
		z-index: -2;
		font-family: Inter, sans-serif;
		color: var(--color-gray-7);
		z-index: 1;
		text-align: center;
	}
	.button {
		background: var(--color-gray-1);
		padding: 0.5rem 1rem;
		border-radius: var(--primo-border-radius);
		font-size: 0.875rem;
		text-decoration: none;
		color: var(--color-gray-7);
	}
</style>
