<script module>
	import { writable } from 'svelte/store'
	const orientation = writable('horizontal')
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import LargeSwitch from '../../../ui/LargeSwitch.svelte'
	import FullCodeEditor from './FullCodeEditor.svelte'
	import ComponentPreview, { refresh_preview, has_error } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields, { setFieldEntries } from '../../../components/Fields/FieldsContent.svelte'
	import { locale } from '../../../stores/app/misc.js'
	import { site_html } from '$lib/builder/stores/app/page.js'
	import { watch } from 'runed'
	import { onModKey } from '$lib/builder/utils/keyboard'
	import { browser } from '$app/environment'
	import { PageSectionEntries, PageSections, PageEntries, PageTypeSectionEntries, SiteSymbolFields, SiteSymbols, SiteSymbolEntries, SiteEntries, Sites } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import type { PageTypeSection } from '$lib/common/models/PageTypeSection'
	import { current_user } from '$lib/pocketbase/user'
	import * as _ from 'lodash-es'
	import { useContent } from '$lib/Content.svelte'
	import { self } from '$lib/pocketbase/managers'
	import { beforeNavigate } from '$app/navigation'
	import { setUserActivity } from '$lib/UserActivity.svelte'
	import { read_only } from '$lib/pocketbase/author_mode'

	let {
		component,
		tab = $bindable('content'),
		has_unsaved_changes = $bindable(false),
		header = {
			label: 'Create Component',
			icon: 'fas fa-code',
			button: {
				icon: 'fas fa-plus',
				label: 'Add to page',
				onclick: (component) => {
					console.warn('Component not going anywhere', component)
				}
			}
		}
	}: {
		component: ObjectOf<typeof PageTypeSection> | ObjectOf<typeof PageSections>
		tab: string
		has_unsaved_changes: boolean
		header?: any
	} = $props()

	setUserActivity('page_type' in component ? { page_type_section: component.id } : { page_section: component.id })

	// Data will be loaded automatically by CollectionMapping system when accessed

	const symbol = $derived(SiteSymbols.one(component.symbol))
	const fields = $derived(symbol?.fields())
	const entries = $derived('page_type' in component ? component.entries() : 'page' in component ? component.entries() : undefined)
	const data = $derived(useContent(component, { target: 'cms' }))
	const component_data = $derived(data && (data[$locale] ?? {}))

	const initial_code = $state({ html: symbol?.html, css: symbol?.css, js: symbol?.js })
	const initial_data = $state(_.cloneDeep(component_data))
	let loading = $state(false)
	let newly_created_fields = new Set()

	// Create completions array in field order for autocomplete
	const completions = $derived(
		fields && component_data
			? fields
					.filter((field) => field.key && component_data.hasOwnProperty(field.key))
					.sort((a, b) => (a.index || 0) - (b.index || 0))
					.map((field, index) => {
						const value = component_data[field.key]
						const detail = Array.isArray(value)
							? `[ ${typeof value[0]} ]`
							: typeof value === 'object' && value !== null
								? '{ ' +
									Object.entries(value)
										.map(([key, val]) => `${key}:${typeof val}`)
										.join(', ') +
									' }'
								: typeof value

						return {
							label: field.key,
							type: 'variable',
							detail,
							boost: 100 - index, // Higher boost for earlier fields (maintains order)
							apply: (view, completion, from, to) => {
								// Check if there's already a closing bracket after the cursor
								const afterCursor = view.state.doc.sliceString(to, to + 1)
								const insert = field.key + (afterCursor === '}' ? '' : '}')
								view.dispatch({
									changes: { from, to, insert }
								})
							}
						}
					})
			: []
	)

	beforeNavigate((nav) => {
		if (has_unsaved_changes) {
			// Prevent navigation when there are unsaved changes
			nav.cancel()
			alert('You have unsaved changes. Please save before navigating away.')
		}
	})

	// Set up hotkey listeners for modal (global fallback)
	onModKey('e', toggle_tab)

	// Save component
	onModKey('s', save_component)

	function toggle_tab() {
		if ($current_user?.siteRole !== 'developer') {
			return
		}

		tab = tab === 'code' ? 'content' : 'code'
	}

	async function save_component() {
		// if (!$preview_updated) {
		// 	await refresh_preview()
		// }

		// Browse mode hides the Save button; ⌘S has to match.
		if ($read_only) return

		if (!$has_error && symbol) {
			loading = true

			// Update symbol code (doing this here to prevent compilation for the symbol in the sidebar/background
			SiteSymbols.update(symbol.id, { html, css, js })

			// Copy entries for newly created fields to the symbol
			if (newly_created_fields.size > 0 && entries) {
				for (const fieldId of newly_created_fields) {
					// Find entries for this field in the section (only top-level entries for now)
					const fieldEntries = entries.filter((e) => e.field === fieldId && !e.parent)

					// Copy each entry to the symbol (newly created fields won't have symbol entries yet)
					for (const entry of fieldEntries) {
						SiteSymbolEntries.create({
							field: entry.field,
							locale: entry.locale,
							value: entry.value,
							index: entry.index
							// Note: not copying parent relationships for now as that would require complex mapping
						})
					}
				}

				// Clear the set after copying
				newly_created_fields.clear()
			}

			SiteSymbols.update(symbol.id, { html, css, js })
			await self.commit()
			loading = false

			header.button.onclick()
		}
	}

	let html = $state(symbol?.html ?? '')
	let css = $state(symbol?.css ?? '')
	let js = $state(symbol?.js ?? '')

	// Compare current state to initial data (explicit watch)
	watch(
		() => [html, css, js, component_data],
		() => {
			const code_changed = html !== initial_code.html || css !== initial_code.css || js !== initial_code.js
			const data_changed = !_.isEqual(initial_data, component_data)
			has_unsaved_changes = code_changed || data_changed
		}
	)

	// Add beforeunload listener via effect (lifecycle)
	$effect(() => {
		if (!browser) return
		if (!has_unsaved_changes) return

		const handleBeforeUnload = (e) => {
			e.preventDefault()
			e.returnValue = ''
			return ''
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => window.removeEventListener('beforeunload', handleBeforeUnload)
	})

	// Create code object for ComponentPreview)
	let code = $derived({
		html: html || '<!-- Add your HTML here -->',
		css: css || '/* Add your CSS here */',
		js: js || ''
	})
</script>

<Dialog.Header
	title={symbol?.name || 'Section'}
	icon="tabler:section-filled"
	button={$read_only
		? undefined
		: {
				label: header.button.label || 'Save',
				hint: '⌘S',
				loading,
				onclick: save_component,
				disabled: $has_error || loading
			}}
>
	{#if $current_user?.siteRole === 'developer'}
		<LargeSwitch bind:active_tab_id={tab} />
	{/if}
</Dialog.Header>

<main lang={$locale}>
	<PaneGroup direction={$orientation} class="flex gap-1">
		<Pane defaultSize={50} class="flex flex-col">
			{#if tab === 'code'}
				<FullCodeEditor bind:html bind:css bind:js data={component_data} {completions} storage_key={symbol?.id} on:save={save_component} on:mod-e={toggle_tab} on:mod-r={() => $refresh_preview()} />
			{:else if tab === 'content' && fields && entries}
				<Fields
					entity={component}
					{fields}
					{entries}
					create_field={(data) => {
						if ($read_only || !symbol) {
							return
						}

						// Get the highest index for fields at this level
						const siblingFields = (fields ?? []).filter((f) => (data?.parent ? f.parent === data.parent : !f.parent))
						const nextIndex = Math.max(...siblingFields.map((f) => f.index || 0), -1) + 1

						const newField = SiteSymbolFields.create({
							type: 'text',
							key: '',
							label: '',
							config: null,
							symbol: symbol.id,
							...data,
							index: nextIndex
						})

						// Track this as a newly created field
						if (newField) {
							has_unsaved_changes = true
							newly_created_fields.add(newField.id)
						}
					}}
					oninput={(values) => {
						if ($read_only) return
						if ('page_type' in component) {
							setFieldEntries({
								fields,
								entries,
								updateEntry: PageTypeSectionEntries.update,
								createEntry: (data) => PageTypeSectionEntries.create({ ...data, section: component.id }),
								values
							})
						} else {
							setFieldEntries({
								fields,
								entries,
								updateEntry: PageSectionEntries.update,
								createEntry: (data) => PageSectionEntries.create({ ...data, section: component.id }),
								values
							})
						}
					}}
					onchange={({ id, data }) => {
						if ($read_only) return
						SiteSymbolFields.update(id, data)
					}}
					ondelete={(field) => {
						if ($read_only) return
						SiteSymbolFields.delete(field.id)
					}}
					ondelete_entry={(entry_id) => {
						if ($read_only) return
						if ('page_type' in component) {
							PageTypeSectionEntries.delete(entry_id)
						} else {
							PageSectionEntries.delete(entry_id)
						}
					}}
				/>
			{/if}
		</Pane>
		<PaneResizer class="PaneResizer" />
		<Pane defaultSize={50}>
			<ComponentPreview id={symbol?.id} {code} data={component_data} {fields} bind:orientation={$orientation} view="small" {loading} head={$site_html} />
		</Pane>
	</PaneGroup>
</main>

<style lang="postcss">
	main {
		display: flex; /* to help w/ positioning child items in code view */
		background: var(--primo-color-black);
		color: var(--color-gray-2);
		flex: 1;
		overflow: hidden;

		--Button-bg: var(--color-gray-8);
		--Button-bg-hover: var(--color-gray-9);
	}

	:global(.PaneResizer) {
		width: 3px;
		background: var(--color-gray-9);
	}
</style>
