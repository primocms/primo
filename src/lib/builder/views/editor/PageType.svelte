<script>
	import _ from 'lodash-es'
	import { tick } from 'svelte'
	import { fade } from 'svelte/transition'
	import { flip } from 'svelte/animate'
	import UI from '../../ui/index.js'
	import ComponentNode from './Layout/ComponentNode.svelte'
	import BlockToolbar from './Layout/BlockToolbar.svelte'
	import DropIndicator from './Layout/DropIndicator.svelte'
	import SymbolPalette from './Layout/SymbolPalette.svelte'
	import LockedOverlay from './Layout/LockedOverlay.svelte'
	import symbols from '$lib/builder/stores/data/symbols'
	import { hydrate_page_type } from '$lib/builder/stores/hydration'
	import { code as siteCode, design as siteDesign } from '../../stores/data/site.js'
	import { locale, locked_blocks } from '../../stores/app/misc.js'
	import { add_page_type_section, delete_page_type_section } from '$lib/builder/actions/page_types.js'
	import { move_section, update_section } from '$lib/builder/actions/sections.js'
	import modal from '../../stores/app/modal.js'
	import sections from '../../stores/data/sections.js'
	import { get_section } from '../../stores/helpers.js'
	import { dropTargetForElements } from '../../libraries/pragmatic-drag-and-drop/entry-point/element/adapter.js'
	import { attachClosestEdge, extractClosestEdge } from '../../libraries/pragmatic-drag-and-drop-hitbox/closest-edge.js'

	let { page } = $props()

	hydrate_page_type(page)

	// Fade in page when all components mounted
	let page_mounted = $state(true)

	// detect when all sections are mounted
	let sections_mounted = $state(0)

	async function lock_block(block_id) {
		// TODO
	}

	function unlock_block() {
		// TODO
	}

	let hovered_section = $state(null)

	let block_toolbar_element = $state()
	let page_el = $state()
	let hovered_block_el = $state()

	let showing_block_toolbar = $state(false)
	async function show_block_toolbar() {
		showing_block_toolbar = true
		await tick()
		position_block_toolbar()
		page_el.addEventListener('scroll', () => {
			showing_block_toolbar = false
		})
	}

	function position_block_toolbar() {
		if (!hovered_block_el) return
		hovered_block_el.appendChild(block_toolbar_element)
		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const block_positions = {
			top: (top <= 43 ? 43 : top) + window.scrollY,
			bottom: bottom >= window.innerHeight ? 0 : window.innerHeight - bottom,
			left,
			right: window.innerWidth - right - window.scrollX
		}
		block_toolbar_element.style.top = `${block_positions.top}px`
		block_toolbar_element.style.bottom = `${block_positions.bottom}px`
		block_toolbar_element.style.left = `${block_positions.left}px`
		block_toolbar_element.style.right = `${block_positions.right}px`
	}

	function hide_block_toolbar() {
		showing_block_toolbar = false
	}

	function edit_component(section_id, showIDE = false) {
		lock_block(section_id)
		const section = get_section(section_id) // get updated section (necessary if actively editing on-page)
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
							update_section(section_id, {
								updated_data,
								changes
							})
							modal.hide()
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

	// using instead of <svelte:head> to enable script tags
	function append_to_head(code) {
		const temp_container = document.createElement('div')
		temp_container.innerHTML = code

		const elements = Array.from(temp_container.childNodes)
		const scripts = []

		elements.forEach((child) => {
			if (child.tagName === 'SCRIPT') {
				scripts.push(child)
			} else {
				document.head.appendChild(child)
			}
		})

		function load_script(script_element) {
			return new Promise((resolve) => {
				const new_script = document.createElement('script')
				Array.from(script_element.attributes).forEach((attr) => {
					new_script.setAttribute(attr.name, attr.value)
				})

				if (script_element.src) {
					new_script.onload = resolve
					new_script.onerror = resolve // Proceed even if a script fails to load
				} else {
					new_script.textContent = script_element.textContent
				}

				document.head.appendChild(new_script)

				if (!script_element.src) {
					resolve()
				}
			})
		}

		scripts.reduce((promise, script_element) => {
			return promise.then(() => load_script(script_element))
		}, Promise.resolve())
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

	function position_drop_indicator() {
		if (!hovered_block_el) return // hovering over page (i.e. below sections)
		hovered_block_el.appendChild(drop_indicator_element)
		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const block_positions = {
			top: (top <= 56 ? 56 : top) + window.scrollY,
			bottom: bottom >= window.innerHeight ? 0 : window.innerHeight - bottom,
			left,
			right: window.innerWidth - right - window.scrollX
		}
		drop_indicator_element.style.left = `${block_positions.left}px`
		drop_indicator_element.style.right = `${block_positions.right}px`

		// surround placeholder palette
		if (dragging.position === 'top' || sections.length === 0) {
			drop_indicator_element.style.top = `${block_positions.top}px`
		} else {
			drop_indicator_element.style.top = `initial`
		}

		if (dragging.position === 'bottom' || sections.length === 0) {
			drop_indicator_element.style.bottom = `${block_positions.bottom}px`
		} else {
			drop_indicator_element.style.bottom = `initial`
		}
	}

	function hide_drop_indicator() {
		showing_drop_indicator = false
		page_el.removeEventListener('scroll', position_drop_indicator)
	}

	let dragging = {
		id: null,
		position: null
	}
	function reset_drag() {
		dragging = {
			id: null,
			position: null
		}
		hide_drop_indicator()
	}

	let dragging_over_section = false

	// detect drags over the page
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

				const last_section_id = $sections[$sections.length - 1]?.id // get the last section (usually that's the drop zone)
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
				add_page_type_section(block_being_dragged, $sections.length)
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
			async onDrag({ self }) {
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
				dragging_over_section = false
			},
			onDrop({ self, source }) {
				const section_dragged_over_index = $sections.find((s) => s.id === self.data.section.id).index
				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (closestEdgeOfTarget === 'top') {
					add_page_type_section(block_being_dragged, section_dragged_over_index)
				} else if (closestEdgeOfTarget === 'bottom') {
					add_page_type_section(block_being_dragged, section_dragged_over_index + 1)
				}
				reset_drag()
			}
		})
	}
	$effect.pre(() => {
		hydrate_page_type(page)
	})
	$effect(() => {
		// set_page_html($page_type.code, $siteCode, $siteDesign)
	})
	let page_is_empty = $derived($sections.length === 0)
	$effect(() => {
		if (sections_mounted === $sections.length && sections_mounted !== 0) {
			page_mounted = true
		}
	})
</script>

<!-- Loading Spinner -->
{#if !page_mounted && $sections.length > 0}
	<div class="spinner">
		<UI.Spinner variant="loop" />
	</div>
{/if}

<!-- Drop Indicator -->
{#if showing_drop_indicator}
	<DropIndicator bind:node={drop_indicator_element} />
{/if}

<!-- Block Buttons -->
{#if showing_block_toolbar}
	<BlockToolbar
		bind:node={block_toolbar_element}
		id={hovered_section.id}
		i={hovered_section.index}
		on:delete={async () => delete_page_type_section(hovered_section.id)}
		on:edit-code={() => edit_component(hovered_section.id, true)}
		on:edit-content={() => edit_component(hovered_section.id)}
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
<main data-test bind:this={page_el} class:fadein={page_mounted} lang={$locale} use:drag_fallback>
	{#each $sections.sort((a, b) => a.index - b.index) as section (section.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_mouse_events_have_key_events -->
		{@const locked = $locked_blocks.find((b) => b.active_block === section.id)}
		<!-- {@const in_current_tab = locked?.instance_key === instance_key} -->
		{@const in_current_tab = false}
		<div
			role="region"
			use:drag_item={section}
			data-section={section.id}
			data-symbol={section.symbol}
			id="section-{section.id}"
			class:locked
			onmousemove={() => {
				if (!section.symbol) return
				if (!moving && !showing_block_toolbar) {
					show_block_toolbar()
				}
			}}
			onmouseenter={async ({ target }) => {
				if (!section.symbol) return

				hovered_section = section
				hovered_block_el = target
				if (!moving) {
					show_block_toolbar()
				}
			}}
			onmouseleave={hide_block_toolbar}
			in:fade={{ duration: 100 }}
			animate:flip={{ duration: 100 }}
			data-test-id="page-type-section-{section.id}"
			style="min-height: 3rem;overflow:hidden;position: relative;"
		>
			{#if !section.symbol}
				<SymbolPalette {section} on:mount={() => sections_mounted++} />
			{:else}
				{@const block = $symbols.find((block) => block.id === section.symbol)}
				{#if locked && !in_current_tab}
					<LockedOverlay {locked} />
				{/if}
				<ComponentNode
					{section}
					{block}
					on:lock={() => lock_block(section.id)}
					on:unlock={() => unlock_block()}
					on:mount={() => sections_mounted++}
					on:resize={() => {
						if (showing_block_toolbar) {
							position_block_toolbar()
						}
					}}
				/>
			{/if}
		</div>
	{/each}
</main>

<!-- {@html html_below || ''} -->

<style lang="postcss">
	.spinner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 5;
		--Spinner-font-size: 3rem;
		--Spinner-color: var(--primo-color-brand);
		--Spinner-color-opaque: rgba(248, 68, 73, 0.2);
	}
	main {
		transition: 0.2s opacity;
		opacity: 0;
		border-top: 0;
		height: 100%;
		/* padding-top: 42px; */
		overflow: auto;
		box-sizing: border-box;
		overflow: auto;
	}
	main.fadein {
		opacity: 1;
	}
</style>
