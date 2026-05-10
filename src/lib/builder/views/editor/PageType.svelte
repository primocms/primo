<script lang="ts">
	import * as _ from 'lodash-es'
	import { tick } from 'svelte'
	import { fade } from 'svelte/transition'
	import { site_context, page_type_context } from '$lib/builder/stores/context'
	import { flip } from 'svelte/animate'
	import UI from '../../ui/index.js'
	import * as Dialog from '$lib/components/ui/dialog'
	import SectionEditor from '$lib/builder/views/modal/SectionEditor/SectionEditor.svelte'
	import ComponentNode from './Layout/ComponentNode.svelte'
	import BlockToolbar from './Layout/BlockToolbar-simple.svelte'
	import DropIndicator from './Layout/DropIndicator.svelte'
	import CodeEditor from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import { locale, dragging_symbol } from '../../stores/app/misc.js'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { PageTypes, PageTypeSections, PageTypeSectionEntries, SiteSymbolEntries, Sites, SiteSymbols } from '$lib/pocketbase/collections'
	import { self as pb } from '$lib/pocketbase/managers'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { setUserActivity } from '$lib/UserActivity.svelte'
	import { onModKey } from '$lib/builder/utils/keyboard'
	import Icon from '@iconify/svelte'
	import { useCopyEntries } from '$lib/workers/CopyEntries.svelte.js'

	let { page_type }: { page_type: ObjectOf<typeof PageTypes> } = $props()

	setUserActivity({ page_type: page_type.id })

	// Set context so child components can access the page type
	const context = $state({ value: page_type })
	page_type_context.set(context)
	$effect(() => {
		context.value = page_type
	})

	const { value: site } = site_context.get()
	const site_symbols = $derived(site?.symbols() ?? [])
	const page_type_sections = $derived(page_type?.sections() ?? [])
	const page_type_symbols = $derived(page_type?.symbols() ?? [])

	// Group sections by zone
	const header_sections = $derived(page_type_sections.filter((s) => s.zone === 'header').sort((a, b) => a.index - b.index))
	const body_sections = $derived(page_type_sections.filter((s) => s.zone === 'body').sort((a, b) => a.index - b.index))
	const footer_sections = $derived(page_type_sections.filter((s) => s.zone === 'footer').sort((a, b) => a.index - b.index))

	// Page type head and foot editors
	let head = $state(page_type.head || '')
	let foot = $state(page_type.foot || '')
	let save_timeout = null

	// Update head and foot when page type changes
	$effect(() => {
		head = page_type.head || ''
		foot = page_type.foot || ''
	})

	// Head editor resize state
	const storage_key = `head-editor-height-${page_type.id}`
	let head_editor_height = $state(typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem(storage_key) || '50') : 50)
	let is_resizing = $state(false)
	let resize_start_y = $state(0)
	let resize_start_height = $state(0)
	let resize_raf = null

	function start_resize(event: MouseEvent) {
		is_resizing = true
		resize_start_y = event.clientY
		resize_start_height = head_editor_height

		const handle_mouse_move = (e: MouseEvent) => {
			if (!is_resizing) return

			// Cancel any pending animation frame
			if (resize_raf) {
				cancelAnimationFrame(resize_raf)
			}

			// Use RAF to throttle updates
			resize_raf = requestAnimationFrame(() => {
				const delta = e.clientY - resize_start_y
				const editor_wrapper = document.querySelector('.head-editor-container .editor-wrapper')
				const max_height = editor_wrapper ? editor_wrapper.clientHeight : 600
				head_editor_height = Math.max(0, Math.min(max_height, resize_start_height + delta))
			})
		}

		const handle_mouse_up = () => {
			is_resizing = false
			document.removeEventListener('mousemove', handle_mouse_move)
			document.removeEventListener('mouseup', handle_mouse_up)

			// Save to localStorage
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(storage_key, head_editor_height.toString())
			}
		}

		document.addEventListener('mousemove', handle_mouse_move)
		document.addEventListener('mouseup', handle_mouse_up)
	}

	async function save_page_type_code() {
		if (!page_type) return
		PageTypes.update(page_type.id, { head, foot })
		await pb.commit()
	}

	// Auto-save with delay
	function debounced_save() {
		if (save_timeout) {
			clearTimeout(save_timeout)
		}
		save_timeout = setTimeout(save_page_type_code, 1000) // 1 second delay
	}

	// Watch for changes to head and foot values
	$effect(() => {
		if (page_type && (head !== page_type.head || foot !== page_type.foot)) {
			debounced_save()
		}
	})

	// Check if page type is static (no symbols toggled)
	// Note: This relationship call might need to be replaced with direct collection access if it causes issues
	const is_static_page_type = $derived(page_type_symbols.length === 0)

	// Fade in page when all components mounted
	let page_mounted = $state(true)

	// detect when all sections are mounted
	let sections_mounted = $state(0)

	let hovered_section_id: string | null = $state(null)
	let hovered_section = $derived(page_type_sections.find((s) => s.id === hovered_section_id))

	// Zone-aware position calculations for toolbar
	const hovered_section_zone_position = $derived.by(() => {
		if (!hovered_section_id || !hovered_section) return { index: 0, is_last: false }
		const section_zone = hovered_section.zone || 'body'
		const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone).sort((a, b) => a.index - b.index)
		const position = zone_sections.findIndex((s) => s.id === hovered_section_id)
		const result = {
			index: position,
			is_last: position === zone_sections.length - 1
		}
		return result
	})

	let block_toolbar_element = $state()
	let page_el = $state()
	let hovered_block_el = $state()

	let showing_block_toolbar = $state(false)
	let hovering_toolbar = $state(false)

	// Handle unsaved changes for section editor
	let section_has_unsaved_changes = $state(false)
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

		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const block_positions = {
			top: (top <= 43 ? 43 : top) + window.scrollY,
			bottom: bottom >= window.innerHeight ? 0 : window.innerHeight - bottom,
			left,
			right: window.innerWidth - right - window.scrollX
		}

		// Just update the styles without appending
		if (block_toolbar_element) {
			block_toolbar_element.style.top = `${block_positions.top}px`
			block_toolbar_element.style.bottom = `${block_positions.bottom}px`
			block_toolbar_element.style.left = `${block_positions.left}px`
			block_toolbar_element.style.right = `${block_positions.right}px`
		}
	}

	let hide_toolbar_timeout = null

	function hide_block_toolbar() {
		// Clear any existing timeout
		if (hide_toolbar_timeout) {
			clearTimeout(hide_toolbar_timeout)
		}
		// Hide immediately without delay
		if (!hovering_toolbar) {
			showing_block_toolbar = false
		}
	}

	let editing_section_tab = $state('code')
	function edit_component(tab) {
		if (!hovered_section) return
		editing_section_tab = tab
		editing_section = true
		editing_section_target = hovered_section
	}

	// Listen for Command-E hotkey to open section editor when hovered
	onModKey('e', () => {
		if (hovered_section && hovered_section.id && showing_block_toolbar) {
			editing_section_target = hovered_section
			editing_section_tab = 'code'
			editing_section = true
		}
	})

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

			// Reset display when showing
			if (drop_indicator_element) {
				drop_indicator_element.style.display = 'block'
			}
		}
	}

	function position_drop_indicator() {
		if (!hovered_block_el || !drop_indicator_element) return // hovering over page (i.e. below sections)

		// Only append if not already a child to avoid errors
		if (drop_indicator_element.parentNode !== hovered_block_el) {
			hovered_block_el.appendChild(drop_indicator_element)
		}

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
		if (dragging.position === 'top' || !page_type_sections.length) {
			drop_indicator_element.style.top = `${block_positions.top}px`
		} else {
			drop_indicator_element.style.top = `initial`
		}

		if (dragging.position === 'bottom' || !page_type_sections.length) {
			drop_indicator_element.style.bottom = `${block_positions.bottom}px`
		} else {
			drop_indicator_element.style.bottom = `initial`
		}
	}

	function hide_drop_indicator() {
		showing_drop_indicator = false
		page_el.removeEventListener('scroll', position_drop_indicator)

		// Force reset the drop indicator element position
		if (drop_indicator_element) {
			drop_indicator_element.style.display = 'none'
			drop_indicator_element.style.left = '-9999px'
			drop_indicator_element.style.top = '-9999px'
		}
	}

	// Simple drag state tracking
	let dragging_over_section = $state(false)
	let hovering_over_zone = $state(null)

	let dragging = $state({
		id: null,
		position: null
	})

	// Clean up when global drag ends
	$effect(() => {
		if (!$dragging_symbol) {
			// Drag ended, clean up everything
			hide_drop_indicator()
			dragging_over_section = false
			hovering_over_zone = null
			dragging = { id: null, position: null }
		}
	})

	// Empty zone drop handler
	function empty_zone_drop(element, zone) {
		dropTargetForElements({
			element,
			getData() {
				return { zone }
			},
			onDragEnter({ source }) {
				if (source.data?.block) {
					hovering_over_zone = zone
				}
			},
			onDragLeave({ source }) {
				if (source.data?.block) {
					hovering_over_zone = null
					hide_drop_indicator()
				}
			},
			async onDrop({ source }) {
				if (!source.data?.block || !page_type) return

				const block_being_dragged = source.data.block
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === zone)
				const target_index = zone_sections.length

				try {
					const new_section = PageTypeSections.create({
						page_type: page_type.id,
						symbol: block_being_dragged.id,
						index: target_index,
						zone: zone
					})

					if (new_section) {
						await copy_symbol_entries_to_section(block_being_dragged.id, new_section.id)
					}

					await pb.commit()
				} catch (error) {
					console.error('Database insertion error (empty zone):', error)
					throw error
				}

				// Clean up drag state
				hide_drop_indicator()
				dragging_over_section = false
				hovering_over_zone = null
			}
		})
	}

	function drag_item(element, section) {
		if (!element) return

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
			canDrop({ source }) {
				// Explicitly allow drops if a block is being dragged
				const canDrop = !!source.data?.block
				return canDrop
			},
			onDragEnter({ source }) {
				if (source.data?.block) {
					dragging_over_section = true
					hovering_over_zone = section.zone || 'body'
				}
			},
			onDragLeave({ source }) {
				if (source.data?.block) {
					dragging_over_section = false
					hovering_over_zone = null
					// Hide drop indicator when leaving section
					setTimeout(() => {
						if (!dragging_over_section) {
							hide_drop_indicator()
						}
					}, 50)
				}
			},
			async onDrag({ self, source }) {
				if (!source.data?.block) return

				hovered_block_el = self.element
				if (dragging.id !== self.data.section.id || dragging.position !== extractClosestEdge(self.data)) {
					dragging = {
						id: self.data.section.id,
						position: extractClosestEdge(self.data)
					}
				}

				// Show drop indicator
				if (!showing_drop_indicator) {
					await show_drop_indicator()
				}
				position_drop_indicator()
			},
			async onDrop({ self, source }) {
				if (!source.data?.block || !page_type) return

				const block_being_dragged = source.data.block
				const section_dragged_over = self.data.section
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				const section_zone = section_dragged_over.zone || 'body'

				// Get sections in this zone, sorted by index
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone).sort((a, b) => a.index - b.index)

				// Find the position of the dragged-over section within this zone
				const section_position_in_zone = zone_sections.findIndex((s) => s.id === section_dragged_over.id)
				const target_position = closestEdgeOfTarget === 'top' ? section_position_in_zone : section_position_in_zone + 1

				try {
					// Create new section first to avoid visual jumps
					const new_section = PageTypeSections.create({
						page_type: page_type.id,
						symbol: block_being_dragged.id,
						index: target_position,
						zone: section_zone
					})

					if (new_section) {
						await copy_symbol_entries_to_section(block_being_dragged.id, new_section.id)
					}

					// Update indices of existing sections in this zone that come after the insertion position
					const sections_to_update = zone_sections.slice(target_position)
					for (const section of sections_to_update) {
						PageTypeSections.update(section.id, { index: section.index + 1 })
					}

					await pb.commit()
				} catch (error) {
					console.error('Database insertion error:', error)
					throw error
				}

				// Clean up drag state
				hide_drop_indicator()
				dragging_over_section = false
				hovering_over_zone = null
			}
		})
	}
	$effect(() => {
		if (sections_mounted === page_type?.sections.length && sections_mounted !== 0) {
			page_mounted = true
		}
	})

	let editing_section = $state(false)
	let editing_section_target = $state<ObjectOf<typeof PageTypeSections>>()

	let copying_entries = $state(false)
	let source_symbol_id = $state<string>()
	let destination_section_id = $state<string>()
	const source_symbol = $derived(source_symbol_id ? SiteSymbols.one(source_symbol_id) : undefined)
	const destination_section = $derived(destination_section_id ? PageTypeSections.one(destination_section_id) : undefined)
	const copy_symbol_entries = $derived(useCopyEntries([source_symbol]))

	// Establish reactive dependency for copy_symbol_entries worker
	$effect(() => {
		copy_symbol_entries
	})
	async function copy_symbol_entries_to_section(symbol_id: string, section_id: string) {
		source_symbol_id = symbol_id
		destination_section_id = section_id
	}
	$effect(() => {
		if (!source_symbol) return
		if (!destination_section) return
		if (copying_entries) return

		copying_entries = true
		copy_symbol_entries
			.run(source_symbol, destination_section)
			.catch((error) => {
				console.error('Failed to copy symbol entries:', error)
			})
			.finally(() => {
				source_symbol_id = undefined
				destination_section_id = undefined
				copying_entries = false
			})
	})
</script>

<Dialog.Root
	bind:open={editing_section}
	onOpenChange={(open) => {
		if (!open) {
			// Check for unsaved changes before closing
			if (section_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					// Prevent closing by reopening the dialog
					editing_section = true
					return
				}
				// User confirmed, discard changes
				pb.discard()
			}
		}
	}}
>
	<Dialog.Content class="z-[999] w-[calc(100vw_-_1rem)] max-w-none h-[calc(100vh_-_1rem)] flex flex-col p-2 gap-2">
		<SectionEditor
			component={editing_section_target}
			tab={editing_section_tab}
			bind:has_unsaved_changes={section_has_unsaved_changes}
			header={{
				button: {
					label: 'Save',
					onclick: () => {
						hovering_toolbar = false
						editing_section = false
					}
				}
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<!-- Loading Spinner -->
{#if !page_mounted && page_type?.sections.length}
	<div class="spinner">
		<UI.Spinner variant="loop" />
	</div>
{/if}

<!-- Drop Indicator -->
{#if showing_drop_indicator}
	<DropIndicator bind:node={drop_indicator_element} />
{:else}
	<!-- Debug: indicator should be hidden -->
	<!-- {console.log('Drop indicator should be hidden')} -->
{/if}

<!-- Block Buttons -->
{#if showing_block_toolbar}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute z-50"
		onmouseenter={() => {
			hovering_toolbar = true
		}}
		onmouseleave={() => {
			hovering_toolbar = false
			showing_block_toolbar = false
		}}
	>
		<BlockToolbar
			bind:node={block_toolbar_element}
			id={hovered_section_id}
			i={hovered_section_zone_position.index}
			is_last={hovered_section_zone_position.is_last}
			on:delete={async () => {
				if (!hovered_section_id) return
				const section_to_delete = page_type_sections.find((s) => s.id === hovered_section_id)
				if (!section_to_delete) return

				const section_id = hovered_section_id
				showing_block_toolbar = false
				hovered_section_id = null

				// Delete the section
				PageTypeSections.delete(section_id)

				// Reindex sections in the same zone that come after the deleted section
				const section_zone = section_to_delete.zone || 'body'
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone && s.id !== section_id).sort((a, b) => a.index - b.index)

				// Update indices of sections that come after the deleted section
				const sections_after_deleted = zone_sections.filter((s) => s.index > section_to_delete.index)
				for (const section of sections_after_deleted) {
					PageTypeSections.update(section.id, { index: section.index - 1 })
				}

				await pb.commit()
			}}
			on:edit-code={() => edit_component('code')}
			on:edit-content={() => edit_component('content')}
			on:moveUp={async () => {
				if (!hovered_section_id) return
				moving = true
				hide_block_toolbar()

				const section = page_type_sections.find((s) => s.id === hovered_section_id)
				if (!section) return

				const section_zone = section.zone || 'body'
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone).sort((a, b) => a.index - b.index)
				const current_position = zone_sections.findIndex((s) => s.id === section.id)

				if (current_position > 0) {
					// Three-step swap to avoid unique constraint violation
					const section_above = zone_sections[current_position - 1]
					const section_index = section.index
					const above_index = section_above.index

					// Find a temporary index that won't conflict (use max + 1000)
					const max_index = Math.max(...zone_sections.map((s) => s.index))
					const temp_index = max_index + 1000

					// Step 1: Move current section to temp position and commit
					PageTypeSections.update(section.id, { index: temp_index })
					await pb.commit()

					// Step 2: Move above section to current position and commit
					PageTypeSections.update(section_above.id, { index: section_index })
					await pb.commit()

					// Step 3: Move current section to above position and commit
					PageTypeSections.update(section.id, { index: above_index })
					await pb.commit()
				}

				setTimeout(() => {
					moving = false
				}, 300)
			}}
			on:moveDown={async () => {
				if (!hovered_section_id) return
				moving = true
				hide_block_toolbar()

				const section = page_type_sections.find((s) => s.id === hovered_section_id)
				if (!section) return

				const section_zone = section.zone || 'body'
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone).sort((a, b) => a.index - b.index)
				const current_position = zone_sections.findIndex((s) => s.id === section.id)

				if (current_position < zone_sections.length - 1) {
					// Three-step swap to avoid unique constraint violation
					const section_below = zone_sections[current_position + 1]
					const section_index = section.index
					const below_index = section_below.index

					// Find a temporary index that won't conflict (use max + 1000)
					const max_index = Math.max(...zone_sections.map((s) => s.index))
					const temp_index = max_index + 1000

					// Step 1: Move current section to temp position and commit
					PageTypeSections.update(section.id, { index: temp_index })
					await pb.commit()

					// Step 2: Move below section to current position and commit
					PageTypeSections.update(section_below.id, { index: section_index })
					await pb.commit()

					// Step 3: Move current section to below position and commit
					PageTypeSections.update(section.id, { index: below_index })
					await pb.commit()
				}

				setTimeout(() => {
					moving = false
				}, 300)
			}}
		/>
	</div>
{/if}

<!-- Page Type Layout -->
<main id="#Page" data-test bind:this={page_el} class:fadein={page_mounted} class:dragging={$dragging_symbol} class:resizing-editor={is_resizing} lang={$locale}>
	<div class="page-content">
		<!-- Head HTML Editor (Resizable) -->
		<div class="head-editor-container">
			<div class="zone-label">Head HTML</div>
			<div class="code-zone head-zone" style="height: {head_editor_height}px;">
				<CodeEditor mode="html" bind:value={head} on:save={save_page_type_code} />
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="resize-handle" onmousedown={start_resize} class:resizing={is_resizing}>
				<span class="grab-handle">
					<Icon icon="mdi:drag-vertical-variant" />
				</span>
			</div>
		</div>

		<div class="zones-container">
			<!-- Header Zone -->
			<div class="zone-label">Header</div>
			<section class="page-zone header-zone" class:dragging-over={hovering_over_zone === 'header'} data-zone="header">
				{#each header_sections as section (section.id)}
					{@const symbol = site_symbols.find((s) => s.id === section.symbol)}
					<div
						role="region"
						use:drag_item={section}
						data-section={section.id}
						data-symbol={symbol?.id}
						id="section-{section.id}"
						onmousemove={() => {
							if (!moving && !showing_block_toolbar) {
								show_block_toolbar()
							}
						}}
						onmouseenter={async ({ target }) => {
							hovered_section_id = section.id
							hovered_block_el = target
							if (!moving) {
								show_block_toolbar()
							}
						}}
						onmouseleave={() => {
							setTimeout(() => {
								if (hovered_section_id === section.id) {
									hide_block_toolbar()
								}
							}, 50)
						}}
						animate:flip={{ duration: 100 }}
						data-test-id="page-type-section-{section.id}"
						style="min-height: 3rem;overflow:hidden;position: relative;"
					>
						{#if symbol}
							<ComponentNode
								{section}
								block={symbol}
								on:mount={() => sections_mounted++}
								on:resize={() => {
									if (showing_block_toolbar) {
										position_block_toolbar()
									}
								}}
							/>
							<!-- {:else}
							<div in:fade|local={{ delay: 1000 }} style="background: #f44336; color: white; padding: 1rem; margin: 0.5rem;">
								⚠️ Symbol not found: {section.symbol}
							</div> -->
						{/if}
					</div>
				{/each}
				{#if header_sections.length === 0}
					<div class="empty-zone" use:empty_zone_drop={'header'}>
						<span>Drag blocks here for the header</span>
					</div>
				{/if}
			</section>

			<!-- Body Zone -->
			<div class="zone-label">
				Body
				{#if is_static_page_type}
					<span class="zone-mode">(Static)</span>
				{:else}
					<span class="zone-mode">(Dynamic)</span>
				{/if}
			</div>
			<section class="page-zone body-zone" class:dragging-over={hovering_over_zone === 'body'} data-zone="body">
				{#each body_sections as section (section.id)}
					{@const symbol = site_symbols.find((s) => s.id === section.symbol)}
					<div
						role="region"
						use:drag_item={section}
						data-section={section.id}
						data-symbol={symbol?.id}
						id="section-{section.id}"
						onmousemove={() => {
							if (!moving && !showing_block_toolbar) {
								show_block_toolbar()
							}
						}}
						onmouseenter={async ({ target }) => {
							hovered_section_id = section.id
							hovered_block_el = target
							if (!moving) {
								show_block_toolbar()
							}
						}}
						onmouseleave={() => {
							setTimeout(() => {
								if (hovered_section_id === section.id) {
									hide_block_toolbar()
								}
							}, 50)
						}}
						animate:flip={{ duration: 100 }}
						data-test-id="page-type-section-{section.id}"
						style="min-height: 3rem;overflow:hidden;position: relative;"
					>
						{#if symbol}
							<ComponentNode
								{section}
								block={symbol}
								on:mount={() => sections_mounted++}
								on:resize={() => {
									if (showing_block_toolbar) {
										position_block_toolbar()
									}
								}}
							/>
							<!-- {:else}
							<div in:fade|local={{ delay: 1000 }} style="background: #f44336; color: white; padding: 1rem; margin: 0.5rem;">
								⚠️ Symbol not found: {section.symbol}
							</div> -->
						{/if}
					</div>
				{/each}
				{#if body_sections.length === 0}
					<div class="empty-zone main-body" use:empty_zone_drop={'body'}>
						{#if is_static_page_type}
							<span>Drag blocks here for static body content</span>
						{:else}
							<span>Drag blocks here for default body content (users can modify)</span>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Footer Zone -->
			<div class="zone-label">Footer</div>
			<section class="page-zone footer-zone" class:dragging-over={hovering_over_zone === 'footer'} data-zone="footer">
				{#each footer_sections as section (section.id)}
					{@const symbol = site_symbols.find((s) => s.id === section.symbol)}
					<div
						role="region"
						use:drag_item={section}
						data-section={section.id}
						data-symbol={symbol?.id}
						id="section-{section.id}"
						onmousemove={() => {
							if (!moving && !showing_block_toolbar) {
								show_block_toolbar()
							}
						}}
						onmouseenter={async ({ target }) => {
							hovered_section_id = section.id
							hovered_block_el = target
							if (!moving) {
								show_block_toolbar()
							}
						}}
						onmouseleave={() => {
							setTimeout(() => {
								if (hovered_section_id === section.id) {
									hide_block_toolbar()
								}
							}, 50)
						}}
						animate:flip={{ duration: 100 }}
						data-test-id="page-type-section-{section.id}"
						style="min-height: 3rem;overflow:hidden;position: relative;"
					>
						{#if symbol}
							<ComponentNode
								{section}
								block={symbol}
								on:mount={() => sections_mounted++}
								on:resize={() => {
									if (showing_block_toolbar) {
										position_block_toolbar()
									}
								}}
							/>
							<!-- {:else}
							<div in:fade|local={{ delay: 1000 }} style="background: #f44336; color: white; padding: 1rem; margin: 0.5rem;">
								⚠️ Symbol not found: {section.symbol}
							</div> -->
						{/if}
					</div>
				{/each}
				{#if footer_sections.length === 0}
					<div class="empty-zone" use:empty_zone_drop={'footer'}>
						<span>Drag blocks here for the footer</span>
					</div>
				{/if}
			</section>

			<!-- Foot Zone -->
			<div class="zone-label">Body Footer HTML</div>
			<section class="code-zone foot-zone">
				<CodeEditor mode="html" bind:value={foot} on:save={save_page_type_code} />
			</section>
		</div>
	</div>
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
		--Spinner-color: var(--primo-primary-color);
		--Spinner-color-opaque: rgba(248, 68, 73, 0.2);
	}
	main {
		padding: 0;
		background-color: var(--color-gray-950);
		transition: 0.2s opacity;
		opacity: 0;
		border-top: 0;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
	}

	.page-content {
		padding: 1rem 0.5rem;
		min-height: 100%;
	}

	.head-editor-container {
		margin-bottom: 1rem;
	}

	.resize-handle {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 8px;
		background: var(--color-gray-900);
		border-top: 1px solid var(--color-gray-800);
		border-bottom: 1px solid var(--color-gray-800);
		cursor: row-resize;
		user-select: none;
		-webkit-user-select: none;
		margin-top: -1px;
	}

	.resize-handle:hover,
	.resize-handle.resizing {
		background: var(--color-gray-800);
	}

	.resize-handle .grab-handle {
		color: var(--color-gray-600);
		transition: color 0.2s;
		transform: rotate(90deg);
	}

	.resize-handle:hover .grab-handle,
	.resize-handle.resizing .grab-handle {
		color: var(--color-gray-400);
	}

	.zones-container {
		padding: 0;
	}

	main.fadein {
		opacity: 1;
	}
	main.dragging :global(iframe) {
		pointer-events: none !important;
	}
	main.resizing-editor [data-section] {
		pointer-events: none !important;
	}

	.page-zone {
		padding: 0.5rem;
		position: relative;
		border: 2px dashed rgba(255, 255, 255, 0.1);
		transition: all 0.2s ease;
		overflow-y: auto;
		border-radius: 8px;
	}

	.page-zone.dragging-over {
		border-color: rgba(59, 130, 246, 0.6) !important;
		background-color: rgba(59, 130, 246, 0.05) !important;
		box-shadow: 0 0 10px rgba(59, 130, 246, 0.2) !important;
	}

	.page-zone.header-zone {
		border-style: solid;
		margin-bottom: 1rem;
	}

	.page-zone.header-zone.dragging-over {
		border-color: rgba(59, 130, 246, 0.8) !important;
	}

	.page-zone.body-zone {
		border-style: solid;
		max-height: none; /* Override the general max-height for body zone */
		margin-bottom: 1rem;
	}

	.page-zone.body-zone.dragging-over {
		border-color: rgba(59, 130, 246, 0.8) !important;
	}

	.page-zone.footer-zone {
		border-style: solid;
		margin-bottom: 1rem;
	}

	.page-zone.footer-zone.dragging-over {
		border-color: rgba(59, 130, 246, 0.8) !important;
	}

	.zone-label {
		font-size: 0.75rem;
		/* font-weight: 500; */
		color: white;
		/* margin-left: 0.5rem; */
		/* margin-top: 0.75rem; */
		margin-bottom: 0.25rem;
		user-select: none;
	}

	.zone-mode {
		font-weight: 400;
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.65rem;
		user-select: none;
	}

	.empty-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 80px;
		color: rgba(107, 114, 128, 0.8);
		font-size: 0.875rem;
		font-style: italic;
		border: 1px dashed rgba(107, 114, 128, 0.3);
		border-radius: 4px;
		user-select: none;
	}

	.empty-zone.main-body {
		min-height: 45vh;
		font-size: 1rem;
	}

	/* Make sections proper drop targets */
	[data-section] {
		overflow: hidden;
		position: relative;
		min-height: 3rem;
	}

	.code-zone {
		position: relative;
		overflow: hidden;
		/* border: 2px solid rgba(255, 255, 255, 0.2); */
		/* background: var(--color-gray-900); */
	}

	.code-zone.head-zone {
		border-color: rgba(76, 175, 80, 0.3);
	}

	.code-zone.foot-zone {
		border-color: rgba(255, 152, 0, 0.3);
	}
</style>
