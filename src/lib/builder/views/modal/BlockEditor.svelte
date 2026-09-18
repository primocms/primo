<script module>
	import { writable, get } from 'svelte/store'
	const orientation = writable('horizontal')
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import LargeSwitch from '$lib/builder/ui/LargeSwitch.svelte'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import FullCodeEditor from './SectionEditor/FullCodeEditor.svelte'
	import ComponentPreview, { has_error, refresh_preview } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields, { setFieldEntries } from '$lib/builder/components/Fields/FieldsContent.svelte'
	import { locale } from '$lib/builder/stores/app/misc.js'
	import { watch } from 'runed'
	import { onModKey } from '$lib/builder/utils/keyboard'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { LibrarySymbolEntries, LibrarySymbolFields, LibrarySymbolGroups, LibrarySymbols, SiteSymbolEntries, SiteSymbolFields, SiteSymbols } from '$lib/pocketbase/collections'
	import { page } from '$app/state'
	import { browser } from '$app/environment'
	import _ from 'lodash-es'
	import { site_context, hide_page_field_field_type_context } from '$lib/builder/stores/context'
	import { site_html } from '$lib/builder/stores/app/page.js'
	import { useContent } from '$lib/Content.svelte'
	import { self } from '$lib/pocketbase/managers'
	import { beforeNavigate } from '$app/navigation'
	import { setUserActivity } from '$lib/UserActivity.svelte'
	import { read_only } from '$lib/pocketbase/author_mode'

	hide_page_field_field_type_context.set(false)

	let {
		block: existing_block,
		tab = $bindable('code'),
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
		},
		symbol_type
	}: {
		block?: ObjectOf<typeof SiteSymbols> | ObjectOf<typeof LibrarySymbols>
		tab?: string
		has_unsaved_changes?: boolean
		header?: any
		symbol_type?: 'site' | 'library'
	} = $props()

	if (existing_block && symbol_type === 'site') {
		setUserActivity({ site_symbol: existing_block.id })
	}

	// Choose the right collections based on symbol type
	const SymbolCollection = $derived(symbol_type === 'library' ? LibrarySymbols : SiteSymbols)
	const FieldCollection = $derived(symbol_type === 'library' ? LibrarySymbolFields : SiteSymbolFields)
	const EntryCollection = $derived(symbol_type === 'library' ? LibrarySymbolEntries : SiteSymbolEntries)

	const { value: site } = site_context.getOr({ value: null })

	const active_symbol_group_id = $derived(page.url.searchParams.get('group'))
	const active_symbol_group = $derived(symbol_type === 'library' && active_symbol_group_id ? LibrarySymbolGroups.one(active_symbol_group_id) : undefined)

	const new_block = () => {
		if (symbol_type === 'library') {
			if (!active_symbol_group) {
				throw new Error('Symbol group not loaded')
			}
			return LibrarySymbols.create({ css: '', html: '', js: '', name: '', group: active_symbol_group.id })
		} else {
			if (!site) {
				throw new Error('Site not loaded')
			}
			return SiteSymbols.create({ css: '', html: '', js: '', name: '', site: site.id })
		}
	}
	const block = $state(existing_block ?? new_block())

	const fields = $derived('site' in block ? block.fields() : block.fields())
	const entries = $derived('site' in block ? block.entries() : block.entries())
	const data = $derived(useContent(block, { target: 'cms' }))
	const component_data = $derived(data && (data[$locale] ?? {}))

	let loading = $state(false)

	beforeNavigate((nav) => {
		if (has_unsaved_changes) {
			// Prevent navigation when there are unsaved changes
			nav.cancel()
			alert('You have unsaved changes. Please save before navigating away.')
		}
	})

	// Set up hotkey listeners for modal
	onModKey('e', toggle_tab)

	// Save component
	onModKey('s', save_component)

	function toggle_tab() {
		tab = tab === 'code' ? 'content' : 'code'
	}

	async function save_component() {
		// Browse mode hides the Save button; ⌘S has to match.
		if ($read_only) return
		if (!$has_error) {
			loading = true
			// Update symbol code (doing this here to prevent compilation for the symbol in the sidebar/background
			SymbolCollection.update(block.id, {
				html,
				css,
				js
			})
			await self.commit()
			// Reset baselines after successful save
			initial_code = { html, css, js }
			initial_data = _.cloneDeep(component_data)
			has_unsaved_changes = false
			loading = false
			header.button.onclick(block)
		}
	}

	let html = $state(block.html)
	let css = $state(block.css)
	let js = $state(block.js)

	// Store initial data for comparison
	let initial_code = $state({ html: block.html, css: block.css, js: block.js })
	let initial_data = $state(_.cloneDeep(component_data))

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
	title={block.name || 'Block'}
	icon="lucide:cuboid"
	button={$read_only
		? undefined
		: {
				...header.button,
				hint: '⌘S',
				loading,
				onclick: save_component,
				disabled: $has_error || loading
			}}
>
	<LargeSwitch bind:active_tab_id={tab} />
</Dialog.Header>

<main lang={$locale}>
	<PaneGroup direction={$orientation} class="flex">
		<Pane defaultSize={50} class="p-1">
			{#if tab === 'code'}
				<FullCodeEditor bind:html bind:css bind:js data={component_data} storage_key={block?.id} on:save={save_component} on:mod-e={toggle_tab} on:mod-r={() => $refresh_preview()} />
			{:else if tab === 'content' && fields}
				<Fields
					entity={block}
					{fields}
					{entries}
					create_field={async (data) => {
						// Get the highest index for fields at this level
						const siblingFields = (fields ?? []).filter((f) => (data?.parent ? f.parent === data.parent : !f.parent))
						const nextIndex = Math.max(...siblingFields.map((f) => f.index || 0), -1) + 1

						FieldCollection.create({
							type: 'text',
							key: '',
							label: '',
							config: null,
							symbol: block.id,
							...data,
							index: nextIndex
						})
					}}
					oninput={(values) => {
						setFieldEntries({
							fields,
							entries,
							updateEntry: EntryCollection.update,
							createEntry: EntryCollection.create,
							values
						})
					}}
					onchange={({ id, data }) => {
						FieldCollection.update(id, data)
					}}
					ondelete={(field) => {
						FieldCollection.delete(field.id)
					}}
					ondelete_entry={(entry_id) => {
						EntryCollection.delete(entry_id)
					}}
				/>
			{/if}
		</Pane>
		<PaneResizer class="PaneResizer" />
		<Pane defaultSize={50}>
			<ComponentPreview id={block.id} bind:orientation={$orientation} view="small" {loading} {code} data={component_data} {fields} head={$site_html} />
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
</style>
