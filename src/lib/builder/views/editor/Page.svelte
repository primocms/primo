<script lang="ts">
	import * as _ from 'lodash-es'
	import { tick, onDestroy } from 'svelte'
	import { createOutlineHistory, moveInOrder, recoverOutlineOperation } from '$lib/builder/stores/app/outline-order.js'
	import { current_user } from '$lib/pocketbase/user'
	import { outline, outlineSelection, outlineInsertion, outlineBusy, outlineMessage, sidebarReveal, pageSidebarTab, readPreference, writePreference } from '$lib/builder/stores/app/outline'
	import { flip } from 'svelte/animate'
	import UI from '$lib/builder/ui'
	import * as Dialog from '$lib/components/ui/dialog'
	import SectionEditor from '$lib/builder/views/modal/SectionEditor/SectionEditor.svelte'
	import ComponentNode from './Layout/ComponentNode.svelte'
	import BlockToolbar from './Layout/BlockToolbar.svelte'
	import DropIndicator from './Layout/DropIndicator.svelte'
	import { locale, dragging_symbol } from '$lib/builder/stores/app/misc'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { beforeNavigate } from '$app/navigation'
	import { Pages, Sites, SiteSymbols, PageSections, PageTypes, PageSectionEntries } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { page_context } from '$lib/builder/stores/context'
	import { onModKey } from '$lib/builder/utils/keyboard'
	import { watch } from 'runed'
	import { setUserActivity } from '$lib/UserActivity.svelte'
	import { self } from '$lib/pocketbase/managers'
	import { author_mode } from '$lib/pocketbase/author_mode'
	import { get } from 'svelte/store'
	import { useCopyEntries } from '$lib/workers/CopyEntries.svelte'

	let { page }: { page: ObjectOf<typeof Pages> } = $props()

	setUserActivity({ page: page.id })

	// Set context so child components can access the page
	const context = $state({ value: page })
	page_context.set(context)
	$effect(() => {
		context.value = page
	})

	const site = $derived(Sites.one(page.site))
	const page_type = $derived(page.page_type ? PageTypes.one(page.page_type) : null)
	const page_type_sections = $derived(page_type?.sections() ?? [])

	// Group page type sections by zone
	const header_sections = $derived(page_type_sections.filter((s) => s.zone === 'header'))
	const footer_sections = $derived(page_type_sections.filter((s) => s.zone === 'footer'))
	const page_type_body_sections = $derived(page_type_sections.filter((s) => s.zone === 'body'))

	const sections = $derived(page.sections() ?? [])

	// Check if page type is static (no symbols toggled - sections can't be added/removed/reordered)
	const is_static_page_type = $derived(page_type ? page_type.symbols()?.length === 0 : false)
	// Resolve the type's available blocks during render. page_type.symbols() is a
	// CollectionMapping relation accessor that lazily spins up a reactive query,
	// so calling it from the drop callback throws Svelte's effect_orphan.
	const page_type_symbol_ids = $derived(new Set((page_type?.symbols() ?? []).map((s) => s.symbol)))

	const history = createOutlineHistory()
	let historyVersion = $state(0)
	let operationChanges = new Map()
	let operationBefore = new Map()
	let originalSections = new Map()
	async function commit_outline() {
		operationChanges = new Map(
			[...self.changes].filter(([id, change]) => (change.collection === 'page_sections' || change.collection === 'page_section_entries') && operationBefore.get(id) !== change)
		)
		await self.commit()
	}
	async function restoreOrder(ids: string[]) {
		if (!can_structure || ids.length !== sections.length || ids.some((id) => !sections.some((s) => s.id === id))) throw new Error('Page structure changed; outline history is no longer applicable')
		ids.forEach((id, index) => PageSections.update(id, { index }))
		await commit_outline()
	}
	const can_edit = $derived($author_mode !== 'files' && !!$current_user?.siteRole)
	const structure_ready = $derived(sections.every((section) => !!SiteSymbols.one(section.symbol)))
	const can_structure = $derived(can_edit && !is_static_page_type && structure_ready)
	const rendered_sections = $derived([...header_sections, ...sections, ...footer_sections].filter((s) => SiteSymbols.one(s.symbol)))
	const outline_rows = $derived.by(() => {
		return rendered_sections.map((section) => {
			const block = SiteSymbols.one(section.symbol)!
			const shared = page_type_sections.some((s) => s.id === section.id)
			return {
				id: section.id,
				name: block.name,
				shared,
				movable: !shared && can_structure,
				zone: 'zone' in section ? section.zone : 'body'
			}
		})
	})
	watch(
		() => page.id,
		(id) => {
			$outlineSelection = readPreference(`primo:outline-selection:${id}`)
			$outlineInsertion = null
			$outlineMessage = ''
			history.clear()
			historyVersion++
		},
		{ lazy: false }
	)
	$effect(() => {
		if (page.sections() !== undefined && page_type?.sections() !== undefined && $outlineSelection && ![...header_sections, ...sections, ...footer_sections].some((s) => s.id === $outlineSelection))
			$outlineSelection = null
		writePreference(`primo:outline-selection:${page.id}`, $outlineSelection ?? '')
	})
	function select_section(id: string, scroll = false) {
		if (!rendered_sections.some((s) => s.id === id)) return
		$outlineSelection = id
		const selectedPage = page.id
		if (scroll)
			tick().then(() => {
				if (page.id !== selectedPage || get(outlineSelection) !== id) return
				page_el?.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })
			})
	}
	async function mutate_outline(operation: () => Promise<void>, message: string) {
		if (!can_edit || get(outlineBusy)) return false
		$outlineBusy = true
		$outlineMessage = ''
		operationBefore = new Map(self.changes)
		operationChanges = new Map()
		originalSections = new Map(sections.map((section) => [section.id, section.values()]))
		try {
			await operation()
			$outlineMessage = message
			return true
		} catch (error) {
			// Compensate only this operation's writes. The manager commits records sequentially,
			// so an API error can otherwise leave half a reorder persisted.
			if (!operationChanges.size)
				operationChanges = new Map(
					[...self.changes].filter(([id, change]) => (change.collection === 'page_sections' || change.collection === 'page_section_entries') && operationBefore.get(id) !== change)
				)
			const recovered = await recoverOutlineOperation({
				changes: self.changes,
				before: operationBefore,
				operation: operationChanges,
				originals: originalSections,
				records: self.records,
				client: self.instance
			})
			self.invalidate_lists({ collection_name: 'page_sections' })
			history.clear()
			historyVersion++
			$outlineMessage = recovered
				? 'Could not save the change. The previous state was restored. Please try again.'
				: 'Could not finish saving or restoring all changes. Reload the page to check its saved state.'
			console.error('Page outline change failed', error)
			return false
		} finally {
			$outlineBusy = false
		}
	}
	async function move_section(id: string, target: number) {
		if (!can_structure) return
		const before = sections.map((s) => s.id)
		const after = moveInOrder(before, id, target)
		if (!after || before.every((id, index) => after[index] === id)) return
		if (await mutate_outline(() => restoreOrder(after), 'Section moved.')) {
			history.record({ undo: () => restoreOrder(before), redo: () => restoreOrder(after) })
			historyVersion++
		}
	}
	$effect(() => {
		historyVersion
		outline.set({
			canUndo: history.canUndo,
			canRedo: history.canRedo,
			undo: async () => {
				await mutate_outline(() => history.undo(), 'Outline change undone.')
				historyVersion++
			},
			redo: async () => {
				await mutate_outline(() => history.redo(), 'Outline change redone.')
				historyVersion++
			},
			pageId: page.id,
			pageName: page.name,
			rows: outline_rows,
			canAdd: can_structure,
			structureReason: structure_ready ? 'This page’s structure is controlled by its template.' : 'Some blocks are unavailable. Structure editing will be available when they load.',
			canEdit: can_edit,
			select: select_section,
			move: move_section,
			add: async (symbolId) => {
				const symbol = SiteSymbols.one(symbolId)
				if (symbol) await add_section_to_page({ symbol, position: get(outlineInsertion) ?? sections.length })
			},
			edit: (id) => {
				if (!rendered_sections.some((s) => s.id === id)) return
				select_section(id)
				hovered_section_id = id
				tick().then(() => {
					if (get(outlineSelection) === id && rendered_sections.some((s) => s.id === id)) edit_section('content')
				})
			}
		})
	})
	onDestroy(() => {
		outline.set(null)
		outlineInsertion.set(null)
	})

	// Fade in page when all components mounted
	let page_mounted = $state(false)

	// detect when all sections are mounted to fade in page
	let sections_mounted = $state(0)

	// How long mounting may stall — no further sections reporting in — before we
	// show the page regardless. Generous enough not to fire on a slow compile.
	const MOUNT_STALL_TIMEOUT_MS = 10000

	beforeNavigate((nav) => {
		if (get(outlineBusy)) {
			nav.cancel()
			return
		}
		// Navigating to the page we're already on doesn't remount sections,
		// so the mount counter would never recover — leaving the spinner stuck
		if (nav.to?.url.href === nav.from?.url.href) return
		page_mounted = false
		sections_mounted = 0
	})

	async function repair_section_indices() {
		// Just use the current order of sections and assign consecutive indices
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].index !== i) {
				PageSections.update(sections[i].id, { index: i })
			}
		}
	}

	let symbol_to_add = $state<ObjectOf<typeof SiteSymbols>>()
	const copy_symbol_entries = $derived(useCopyEntries([symbol_to_add]))
	async function add_section_to_page({ symbol, position }) {
		if (!can_structure || !symbol || !page_type_symbol_ids.has(symbol.id)) return
		let new_id: string | undefined
		const originalOrder = sections.map((s) => s.id)
		const success = await mutate_outline(async () => {
			new_id = await insert_section({ symbol, position: Math.max(0, Math.min(position, sections.length)) })
			$outlineInsertion = null
			// Deliberately stay on the current sidebar tab: dropping several blocks
			// in a row is the normal case, and switching to Outline hid the block
			// list each time.
			if (new_id) select_section(new_id, true)
		}, 'Block added.')
		if (success && new_id) {
			const id = new_id
			let sectionSnapshot: any
			let entrySnapshots: any[] = []
			const addedOrder = sections.map((s) => s.id)
			history.record({
				undo: async () => {
					if (!can_structure || !sections.some((s) => s.id === id) || sections.length !== addedOrder.length || addedOrder.some((id) => !sections.some((section) => section.id === id)))
						throw new Error('Page structure changed')
					// Flush pending inline edits before reading content for undo/redo.
					await self.commit()
					sectionSnapshot = sections.find((s) => s.id === id)!.values()
					const entries = await self.instance!.collection('page_section_entries').getFullList({ filter: `section = "${id}"` })
					entrySnapshots = entries.map(({ id, section, field, locale, value, parent, index }) => ({ id, section, field, locale, value, parent, index }))
					originalOrder.forEach((id, index) => PageSections.update(id, { index }))
					PageSections.delete(id) // The existing relation cascades to its content entries.
					await commit_outline()
					entrySnapshots.forEach((entry) => {
						self.records.set(entry.id, null)
						self.changes.delete(entry.id)
					})
					$outlineSelection = null
				},
				redo: async () => {
					if (!can_structure || sections.length !== originalOrder.length || originalOrder.some((id) => !sections.some((s) => s.id === id))) throw new Error('Page structure changed')
					PageSections.create(sectionSnapshot)
					const pending = [...entrySnapshots]
					const created = new Set<string>()
					while (pending.length) {
						const index = pending.findIndex((entry) => !entry.parent || created.has(entry.parent))
						if (index < 0) throw new Error('Cannot restore nested content')
						const [entry] = pending.splice(index, 1)
						PageSectionEntries.create(entry)
						created.add(entry.id)
					}
					addedOrder.forEach((id, index) => PageSections.update(id, { index }))
					await commit_outline()
					select_section(id, true)
				}
			})
			historyVersion++
		}
		return new_id
	}

	async function insert_section({ symbol, position }) {
		symbol_to_add = symbol
		await tick()

		// Check if indices need repair
		const has_incorrect_indices = sections.some((section, i) => section.index !== i)
		if (has_incorrect_indices) {
			await repair_section_indices()
		}

		// Adjust indices of existing sections that come after the insertion position
		const existing_sections = sections.filter((section) => section.index >= position)

		// Create new section with correct index
		const new_section = PageSections.create({
			page: page.id,
			symbol: symbol.id,
			index: position
		})

		await copy_symbol_entries.run(symbol_to_add!, new_section)

		for (const section of existing_sections) {
			PageSections.update(section.id, { index: section.index + 1 })
		}

		await commit_outline()

		return new_section.id
	}

	async function remove_section_from_page(section_id) {
		if (!can_structure || get(outlineBusy)) return
		const section_to_delete = sections.find((s) => s.id === section_id)
		if (!section_to_delete) return

		// Adjust indices of remaining sections that come after the deleted section
		const sections_to_update = sections.filter((section) => section.index > section_to_delete.index)
		for (const section of sections_to_update) {
			PageSections.update(section.id, { index: section.index - 1 })
		}

		// Delete the section
		PageSections.delete(section_id)
		await self.commit()
	}

	let page_el: HTMLElement = $state()!
	let hovered_block_el = $state()

	////////////////////////////
	// BLOCK TOOLBAR ///////////
	////////////////////////////

	let block_toolbar_element = $state()
	let showing_block_toolbar = $state(false)

	// Add state variables to track hover states
	let hovering_toolbar = $state(false)
	let hovering_section = $state(false)

	async function show_block_toolbar() {
		// Clear any pending hide timeout
		if (hide_toolbar_timeout) {
			clearTimeout(hide_toolbar_timeout)
			hide_toolbar_timeout = null
		}

		if (!showing_block_toolbar) {
			showing_block_toolbar = true
			await tick()
			position_block_toolbar()
			page_el.addEventListener('scroll', position_block_toolbar)
		} else {
			// Already showing, just reposition
			position_block_toolbar()
		}
	}

	async function position_block_toolbar() {
		if (!hovered_block_el || !block_toolbar_element) return

		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const toolbar_height = 44

		// Keep block controls inside the canvas, including when a section scrolls above it.
		const canvas = page_el.getBoundingClientRect()
		const toolbar_top = Math.max(canvas.top, Math.min(top, canvas.bottom - toolbar_height))
		const toolbar_bottom = Math.max(window.innerHeight - canvas.bottom, window.innerHeight - bottom)

		block_toolbar_element.style.position = 'fixed'
		block_toolbar_element.style.top = `${toolbar_top}px`
		block_toolbar_element.style.bottom = `${toolbar_bottom}px`
		block_toolbar_element.style.left = `${left}px`
		block_toolbar_element.style.right = `${window.innerWidth - right}px`
	}

	let hide_toolbar_timeout = null

	// Sections render inside an iframe, which swallows pointer events once the
	// cursor is over it — so a section's mouseleave never fires when the pointer
	// leaves the canvas, and the block toolbar (whose inset shadow draws the
	// block's hover outline) stays on screen. Watch pointer moves at the window
	// and schedule the same hide once the pointer is outside the hovered section;
	// entering the toolbar cancels it, as with the other paths.
	function hide_block_toolbar_if_pointer_left(event: PointerEvent) {
		if (!showing_block_toolbar || hovering_toolbar || !hovered_block_el) return
		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		if (event.clientX >= left && event.clientX <= right && event.clientY >= top && event.clientY <= bottom) return
		hovering_section = false
		if (hide_toolbar_timeout) clearTimeout(hide_toolbar_timeout)
		hide_toolbar_timeout = setTimeout(() => {
			if (!hovering_toolbar && !hovering_section) {
				hovered_section_id = null
				hide_block_toolbar()
			}
		}, 100)
	}

	async function hide_block_toolbar() {
		// Clear any existing timeout
		if (hide_toolbar_timeout) {
			clearTimeout(hide_toolbar_timeout)
		}
		// Only hide if we're not hovering over either the toolbar or the section
		if (!hovering_toolbar && !hovering_section) {
			showing_block_toolbar = false
			page_el.removeEventListener('scroll', position_block_toolbar)
		}
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
			// Reset display style when showing
			if (drop_indicator_element) {
				drop_indicator_element.style.display = ''
			}
			page_el.addEventListener('scroll', position_drop_indicator)
		}
	}

	async function position_drop_indicator() {
		if (!hovered_block_el || !drop_indicator_element) return

		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()

		// Position the line at the appropriate edge
		drop_indicator_element.style.left = `${left}px`
		drop_indicator_element.style.width = `${right - left}px`

		if (dragging.position === 'top') {
			// Show line at the top edge of the section
			drop_indicator_element.style.top = `${top - 2}px`
			drop_indicator_element.style.bottom = 'initial'
		} else if (dragging.position === 'bottom') {
			// Show line at the bottom edge of the section
			drop_indicator_element.style.top = `${bottom - 2}px`
			drop_indicator_element.style.bottom = 'initial'
		}
	}

	function hide_drop_indicator() {
		showing_drop_indicator = false
		if (page_el) {
			page_el.removeEventListener('scroll', position_drop_indicator)
		}
		// Force hide the element immediately
		if (drop_indicator_element) {
			drop_indicator_element.style.display = 'none'
		}
	}

	////////////////////////////

	let editing_section_tab = $state('code')
	async function edit_section(tab) {
		if (!hovered_section || get(outlineBusy)) return
		editing_section = true
		editing_section_tab = tab
	}

	// Listen for Command-E hotkey to open section editor when hovered
	onModKey('e', () => {
		if (hovered_section && showing_block_toolbar && !get(outlineBusy)) {
			editing_section = true
			editing_section_tab = 'code'
		}
	})

	let moving = $state(false) // workaround to prevent block toolbar from showing when moving blocks

	// Handle unsaved changes for section editor
	let section_has_unsaved_changes = $state(false)

	let dragging = $state({
		id: null,
		position: null
	})
	function reset_drag() {
		// Clear any pending drag leave timeout
		if (drag_leave_timeout) {
			clearTimeout(drag_leave_timeout)
			drag_leave_timeout = null
		}

		dragging = {
			id: null,
			position: null
		}
		dragging_over_section = false
		hide_drop_indicator()
	}

	let dragging_over_section = $state(false)
	let drag_leave_timeout = null

	function drag_fallback(element) {
		const cleanup = dropTargetForElements({
			element,
			canDrop: ({ source }) => can_structure && !!source.data.block,
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
				// Clear any pending drag leave timeout since we're still dragging
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

				if (dragging_over_section) return // prevent double-adding block

				// When page is empty, use the empty state div as the drop target
				const section_count = sections.length
				if (section_count === 0) {
					const empty_state_el = page_el.querySelector('.empty-state')
					if (empty_state_el) {
						hovered_block_el = empty_state_el
					} else {
						hovered_block_el = page_el
					}

					hide_drop_indicator()
					dragging = {
						id: 'empty-page',
						position: 'bottom'
					}
					return
				}

				const last_section_id = sections[section_count - 1]?.id ?? page_type_body_sections[page_type_body_sections.length - 1]?.id
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
			onDragLeave({ source }) {
				// Use a timeout to avoid hiding the indicator when briefly leaving the area
				// but still dragging over a valid drop target
				drag_leave_timeout = setTimeout(() => {
					reset_drag()
				}, 100)
			},
			async onDrop({ source }) {
				// Immediately hide drop indicator
				hide_drop_indicator()

				// Clear any pending drag leave timeout
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

				if (dragging_over_section) {
					return // prevent double-adding block
				}
				const block_being_dragged = source.data.block
				const new_section_id = await add_section_to_page({
					symbol: block_being_dragged,
					position: sections.length
				})
				const new_section_el = new_section_id ? page_el.querySelector(`[data-section="${new_section_id}"]`) : null
				if (new_section_el instanceof HTMLElement) {
					new_section_el.scrollIntoView({
						behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
						block: 'center',
						inline: 'center'
					})
				}
				reset_drag()
				$dragging_symbol = false
			}
		})
		return { destroy: cleanup }
	}

	function drag_item(element, section) {
		const cleanup = dropTargetForElements({
			element,
			canDrop: ({ source }) => can_structure && !!source.data.block,
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
				// Clear any pending drag leave timeout since we're still dragging
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

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
				// Clear any pending drag leave timeout since we're entering a valid drop target
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}
				dragging_over_section = true
			},
			onDragLeave() {
				dragging_over_section = false
				// Use a timeout to avoid hiding the indicator when briefly leaving the area
				// but still dragging over a valid drop target
				drag_leave_timeout = setTimeout(() => {
					reset_drag()
				}, 100)
			},
			async onDrop({ self, source }) {
				// Immediately hide drop indicator
				hide_drop_indicator()

				// Clear any pending drag leave timeout
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

				const section_count = sections.length
				const section_dragged_over_index =
					section_count === 0 ? (page_type_body_sections.find((s) => s.id === self.data.section.id)?.index ?? 0) : (sections.find((s) => s.id === self.data.section.id)?.index ?? 0)
				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)

				if (closestEdgeOfTarget === 'top') {
					await add_section_to_page({
						symbol: block_being_dragged,
						position: section_dragged_over_index
					})
				} else if (closestEdgeOfTarget === 'bottom') {
					await add_section_to_page({
						symbol: block_being_dragged,
						position: section_dragged_over_index + 1
					})
				}
				reset_drag()
				$dragging_symbol = false
			}
		})
		return { destroy: cleanup }
	}

	$effect(() => {
		if (!sections) {
			sections_mounted = 0
			page_mounted = false
			return
		}

		const target_count = sections.length

		if (target_count === 0) {
			sections_mounted = 0
			page_mounted = true
			return
		}

		sections_mounted = Math.min(sections_mounted, target_count)
		if (sections_mounted >= target_count) {
			page_mounted = true
			return
		}

		// A section that never reports a mount (its content data never resolves,
		// so it never compiles and never renders an iframe) would otherwise hold
		// the spinner up indefinitely and hide every section that did render.
		// Reveal the page anyway once mounting has stalled, so a single stuck
		// block degrades to a partial page instead of a blank one with no way to
		// tell what went wrong.
		//
		// The effect re-runs on each mount, so this timer is rebuilt while
		// sections are still arriving — it measures time since the last mount,
		// and only fires once progress has actually stopped. The timer is armed
		// whenever sections are outstanding, including after an earlier timeout
		// already revealed the page, so a later stall still gets reported.
		const mounted_so_far = sections_mounted
		const timer = setTimeout(() => {
			console.warn(`[primo] ${target_count - mounted_so_far} of ${target_count} sections did not finish mounting; showing the page anyway.`)
			page_mounted = true
		}, MOUNT_STALL_TIMEOUT_MS)

		return () => clearTimeout(timer)
	})

	type HoveredSectionSource = 'page' | 'page-type'

	let hovered_section_id: string | null = $state(null)
	let hovered_section_details = $state<{
		section: any
		source: HoveredSectionSource | null
		zone: 'header' | 'body' | 'footer' | null
		index: number
		is_last: boolean
	}>({
		section: null,
		source: null,
		zone: null,
		index: 0,
		is_last: false
	})

	watch(
		() => hovered_section_id,
		(hovered_section_id) => {
			if (!hovered_section_id) return
			const page_section = sections!.find((s) => s.id === hovered_section_id)
			const page_type_section = page_type_sections.find((s) => s.id === hovered_section_id)
			const source = page_type_section ? 'page-type' : 'page'
			const zone = page_type_section ? page_type_section.zone : 'body'!
			const index = (page_section || page_type_section)?.index!
			const is_last = (page_section || page_type_section)!.index === (page_section ? sections : page_type_body_sections)!.length - 1
			hovered_section_details = {
				section: page_section || page_type_section,
				source,
				zone,
				index,
				is_last
			}
		}
	)

	let hovered_section = $derived(hovered_section_details?.section ?? null)

	let editing_section = $state(false)
</script>

{#if hovered_section}
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
					self.discard()
				}
			}
		}}
	>
		<Dialog.Content class="z-[999] max-w-none h-full max-h-[calc(100vh_-_1rem)] flex flex-col p-2 gap-2">
			<SectionEditor
				bind:has_unsaved_changes={section_has_unsaved_changes}
				component={hovered_section}
				tab={editing_section_tab}
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
{/if}

<!-- Loading Spinner -->
{#if !page_mounted && sections && sections.length > 1}
	<div class="spinner" style="--Spinner-color: var(--color-gray-7);">
		<UI.Spinner variant="loop" />
	</div>
{/if}

<!-- Drop Indicator -->
{#if showing_drop_indicator}
	<DropIndicator bind:node={drop_indicator_element} />
{/if}

<!-- Block Toolbar -->
{#if sections && page_mounted && showing_block_toolbar}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute z-50"
		onmouseenter={() => {
			hovering_toolbar = true
			// Clear any pending hide timeout when entering toolbar
			if (hide_toolbar_timeout) {
				clearTimeout(hide_toolbar_timeout)
				hide_toolbar_timeout = null
			}
		}}
		onmouseleave={() => {
			hovering_toolbar = false
			// Use the same timeout system
			if (hide_toolbar_timeout) {
				clearTimeout(hide_toolbar_timeout)
			}
			hide_toolbar_timeout = setTimeout(() => {
				hide_block_toolbar()
			}, 100)
		}}
	>
		<BlockToolbar
			bind:node={block_toolbar_element}
			id={hovered_section_id}
			name={outline_rows.find((row) => row.id === hovered_section_id)?.name ?? 'Block'}
			i={hovered_section_details.index}
			is_last={hovered_section_details.is_last}
			immovable={is_static_page_type || hovered_section_details.source === 'page-type'}
			layout_zone={hovered_section_details.zone !== 'body' ? hovered_section_details.zone : null}
			{page_type}
			on:delete={async () => {
				if (get(outlineBusy)) return
				// Get the section ID before clearing state
				const section_id_to_delete = hovered_section_id
				// Force hide the toolbar immediately
				showing_block_toolbar = false
				hovered_section_id = null
				hovered_block_el = null
				page_el.removeEventListener('scroll', position_block_toolbar)

				await remove_section_from_page(section_id_to_delete)
			}}
			on:edit-code={() => edit_section('code')}
			on:edit-content={() => edit_section('content')}
			on:moveUp={() => hovered_section_id && move_section(hovered_section_id, sections.findIndex((s) => s.id === hovered_section_id) - 1)}
			on:moveDown={() => hovered_section_id && move_section(hovered_section_id, sections.findIndex((s) => s.id === hovered_section_id) + 1)}
		/>
	</div>
{/if}

<!-- Page with Zone-Based Layout -->
<svelte:window onpointermove={hide_block_toolbar_if_pointer_left} />
<main id="Page" bind:this={page_el} class:fadein={page_mounted} class:dragging={$dragging_symbol} lang={$locale} use:drag_fallback>
	<!-- Page Type Header Sections -->
	{#if header_sections.length > 0}
		{@const show_block_toolbar_on_hover = page_mounted && !moving}
		<header class="page-header-zone">
			{#each header_sections as page_type_section (page_type_section.id)}
				{@const block = SiteSymbols.one(page_type_section.symbol)}
				{#if block}
					<div
						role="presentation"
						data-section={page_type_section.id}
						class:outline-selected={$outlineSelection === page_type_section.id}
						data-symbol={block?.id}
						class="page-type-section header-section"
						onmousemove={(e) => {
							if (show_block_toolbar_on_hover && hovered_section_id === page_type_section.id) {
								show_block_toolbar()
							}
						}}
						onmouseenter={(e) => {
							hovered_section_id = page_type_section.id
							hovered_block_el = e.currentTarget
							hovering_section = true
							if (show_block_toolbar_on_hover) {
								show_block_toolbar()
							}
						}}
						onmouseleave={() => {
							hovering_section = false
							if (hide_toolbar_timeout) {
								clearTimeout(hide_toolbar_timeout)
							}
							hide_toolbar_timeout = setTimeout(() => {
								if (hovered_section_id === page_type_section.id) {
									hide_block_toolbar()
								}
							}, 100)
						}}
					>
						<ComponentNode
							{block}
							section={page_type_section}
							on:select={() => select_section(page_type_section.id)}
							on:mount={() => sections_mounted++}
							on:resize={() => {
								if (showing_block_toolbar) {
									position_block_toolbar()
								}
							}}
						/>
					</div>
				{/if}
			{/each}
		</header>
	{/if}

	<!-- Page Content Area -->
	{#if sections}
		<section class="page-content-zone flex-1 flex flex-col">
			<!-- Page's Own Sections -->
			{#each sections.filter((s) => SiteSymbols.one(s.symbol)) as section (section.id)}
				{@const block = SiteSymbols.one(section.symbol)!}
				{@const show_block_toolbar_on_hover = page_mounted && !moving}
				<div
					role="presentation"
					data-section={section.id}
					class:outline-selected={$outlineSelection === section.id}
					class:insert-before={$outlineInsertion === section.index}
					class:insert-after={$outlineInsertion === sections.length && section.index === sections.length - 1}
					data-symbol={block?.id}
					onmousemove={(e) => {
						if (show_block_toolbar_on_hover && hovered_section_id === section.id) {
							show_block_toolbar()
						}
					}}
					onmouseenter={async (e) => {
						hovered_section_id = section.id
						hovered_block_el = e.currentTarget
						hovering_section = true
						if (show_block_toolbar_on_hover) {
							show_block_toolbar()
						}
					}}
					onmouseleave={(e) => {
						hovering_section = false
						// Use a single timeout system
						if (hide_toolbar_timeout) {
							clearTimeout(hide_toolbar_timeout)
						}
						hide_toolbar_timeout = setTimeout(() => {
							// Check if we've hovered over a different section in the meantime
							if (hovered_section_id === section.id) {
								hide_block_toolbar()
							}
						}, 100)
					}}
					animate:flip={{ duration: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 100 }}
					use:drag_item={section}
				>
					<ComponentNode
						{block}
						{section}
						on:select={() => select_section(section.id)}
						on:mount={() => sections_mounted++}
						on:resize={() => {
							if (showing_block_toolbar) {
								position_block_toolbar()
							}
						}}
					/>
				</div>
			{/each}

			<!-- Empty State (show when page has no sections) -->
			{#if sections.length === 0}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="empty-state"
					class:insert-before={$outlineInsertion === 0}
					class:dragging-over={$dragging_symbol && dragging.id === 'empty-page'}
					onmouseenter={({ currentTarget }) => {
						hovered_block_el = currentTarget
					}}
					onmouseleave={() => {
						hovered_block_el = null
					}}
				>
					<div class="_container">
						<span class="empty-eyebrow">{page.name}</span>
						<h2>{$dragging_symbol && dragging.id === 'empty-page' ? 'Drop your block here' : can_structure ? 'Make this page your own' : 'No page content yet'}</h2>
						<p>{$dragging_symbol && dragging.id === 'empty-page' ? 'Release to add it to this page.' : can_structure ? 'Drag a block from the Blocks tab into this space to get started.' : !can_edit ? 'This page has no content blocks. You have read-only access.' : 'This page’s content structure is managed by its template.'}</p>
						{#if can_structure}
							<button class="browse-blocks" class:drag-hidden={$dragging_symbol && dragging.id === 'empty-page'} onclick={() => { $pageSidebarTab = 'blocks'; $sidebarReveal += 1 }}>Browse blocks <span aria-hidden="true">→</span></button>
						{/if}
						{#if header_sections.length || footer_sections.length}<small>Your shared {header_sections.length && footer_sections.length ? 'header and footer are' : header_sections.length ? 'header is' : 'footer is'} already in place.</small>{/if}
					</div>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Page Type Footer Sections -->
	{#if footer_sections.length > 0}
		{@const show_block_toolbar_on_hover = page_mounted && !moving}
		<footer class="page-footer-zone">
			{#each footer_sections as page_type_section (page_type_section.id)}
				{@const block = SiteSymbols.one(page_type_section.symbol)}
				{#if block}
					<div
						role="presentation"
						data-section={page_type_section.id}
						class:outline-selected={$outlineSelection === page_type_section.id}
						data-symbol={block?.id}
						class="page-type-section footer-section"
						onmousemove={(e) => {
							if (show_block_toolbar_on_hover && hovered_section_id === page_type_section.id) {
								show_block_toolbar()
							}
						}}
						onmouseenter={(e) => {
							hovered_section_id = page_type_section.id
							hovered_block_el = e.currentTarget
							hovering_section = true
							if (show_block_toolbar_on_hover) {
								show_block_toolbar()
							}
						}}
						onmouseleave={() => {
							hovering_section = false
							if (hide_toolbar_timeout) {
								clearTimeout(hide_toolbar_timeout)
							}
							hide_toolbar_timeout = setTimeout(() => {
								if (hovered_section_id === page_type_section.id) {
									hide_block_toolbar()
								}
							}, 100)
						}}
					>
						<ComponentNode
							{block}
							section={page_type_section}
							on:select={() => select_section(page_type_section.id)}
							on:lock={() => {}}
							on:unlock={() => {}}
							on:mount={() => sections_mounted++}
							on:resize={() => {
								if (showing_block_toolbar) {
									position_block_toolbar()
								}
							}}
						/>
					</div>
				{/if}
			{/each}
		</footer>
	{/if}

	{#if site?.foot}
		<div class="site-foot">
			{@html site.foot}
		</div>
	{/if}
</main>

<style lang="postcss">
	.outline-selected {
		outline: 2px solid #956e51;
		outline-offset: -2px;
	}
	.insert-before {
		border-top: 3px solid var(--primo-primary-color);
	}
	.insert-after {
		border-bottom: 3px solid var(--primo-primary-color);
	}

	[data-section] {
		overflow: hidden;
		position: relative;
		min-height: 2rem;
		line-height: 0;
	}
	.empty-state { background: #f7f7f5; padding: clamp(18px, 4vw, 40px); }
	.empty-state ._container { width: 100%; min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 1px dashed #c9c9c3; border-radius: 8px; padding: 32px 20px; color: #35352f; }
	.empty-state.dragging-over ._container { border: 2px solid #956e51; background: #ede5dc; box-shadow: 0 0 0 4px #956e5118; }
	.empty-state.dragging-over h2 { color: #765337; }
	.empty-state ._container { transition: background-color 120ms, border-color 120ms, box-shadow 120ms; }
	.browse-blocks.drag-hidden { visibility: hidden; }
	@media (prefers-reduced-motion: reduce) { .empty-state ._container { transition: none; } }
	.empty-eyebrow { color: #85857c; font-size: 11px; line-height: 1.5; }
	.empty-state h2 { font-size: clamp(18px, 2.4vw, 23px); font-weight: 500; line-height: 1.3; margin: 0; }
	.empty-state p { font-size: 13px; line-height: 1.6; max-width: 320px; color: #77776e; margin: 0; }
	.empty-state small { font-size: 11px; line-height: 1.5; color: #85857c; margin-top: 8px; max-width: 320px; }
	.browse-blocks { display: inline-flex; align-items: center; gap: 12px; min-height: 38px; padding: 9px 14px; background: #252528; color: #f4f4f5; border: 1px solid #252528; border-radius: 5px; font-size: 12px; margin-top: 4px; }
	.browse-blocks:hover { background: #37373b; }
	.browse-blocks:focus-visible { outline: 2px solid #956e51; outline-offset: 3px; }

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
		--Spinner-color: var(--primo-primary-color);
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
	.site-foot {
		color: black;
	}
</style>
