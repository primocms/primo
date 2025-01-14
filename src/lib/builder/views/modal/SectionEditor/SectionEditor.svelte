<script module>
	import { writable, get } from 'svelte/store'
	const orientation = writable('horizontal')
</script>

<script>
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import LargeSwitch from '../../../ui/LargeSwitch.svelte'
	import _, { chain as _chain } from 'lodash-es'
	import ModalHeader from '../ModalHeader.svelte'
	import FullCodeEditor from './FullCodeEditor.svelte'
	import ComponentPreview, { has_error } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields from '../../../components/Fields/FieldsContent.svelte'
	import { userRole, locale, onMobile } from '../../../stores/app/misc.js'
	import symbols from '../../../stores/data/symbols.js'
	import { get_content_with_synced_values } from '../../../stores/helpers'
	import hotkey_events from '../../../stores/app/hotkey_events.js'
	import site from '$lib/builder/stores/data/site.js'
	import active_page from '$lib/builder/stores/data/page'
	import page_type from '$lib/builder/stores/data/page_type'

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Section} component
	 * @property {string} [tab]
	 * @property {any} [header]
	 */

	/** @type {Props} */
	let {
		component,
		tab = $bindable('content'),
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
	} = $props()

	const symbol = _.cloneDeep($symbols.find((s) => s.id === (component.symbol || component.master.symbol)))

	let local_code = _.cloneDeep(symbol.code)
	let local_fields = $state(_.cloneDeep(symbol.fields))
	let local_content = $state(_.cloneDeep([...component.entries, ...$site.entries, ...$active_page.entries, ...$page_type.entries]))

	let section_entries = $derived(local_content.filter((e) => !e.site && !e.page && !e.page_type))
	let page_entries = $derived(local_content.filter((e) => e.page))
	let site_entries = $derived(local_content.filter((e) => e.site))

	let fields_changes = $state([])
	let content_changes = $state([])

	let loading = false

	// bind raw code to the code editor
	let raw_html = $state(local_code.html)
	let raw_css = $state(local_code.css)
	let raw_js = $state(local_code.js)

	let component_data = $state({})
	function update_component_data() {
		component_data = get_content_with_synced_values({
			fields: local_fields,
			entries: section_entries,
			site: { ...$site, entries: site_entries },
			page: { ...$active_page, entries: page_entries }
		})[$locale]
	}
	$effect.pre(() => {
		update_component_data()
	})

	hotkey_events.on('e', toggle_tab)

	// detect hotkeys from within inputs
	function handle_hotkey(e) {
		const { metaKey, key } = e
		if (metaKey && key === 's') {
			e.preventDefault()
			save_component()
		}
		if (metaKey && key === 'e') {
			e.preventDefault()
			toggle_tab()
		}
	}

	function toggle_tab() {
		tab = tab === 'code' ? 'content' : 'code'
	}

	async function save_component() {
		// if (!$preview_updated) {
		// 	await refresh_preview()
		// }

		if (!$has_error) {
			header.button.onclick(
				{
					code: {
						html: raw_html,
						css: raw_css,
						js: raw_js
					},
					entries: local_content,
					fields: local_fields
				},
				{
					entries: content_changes,
					fields: fields_changes
				}
			)
		}
	}
</script>

<ModalHeader
	{...header}
	warn={() => {
		const code_changed = _.isEqual(component.code, { html: raw_html, css: raw_css, js: raw_js })
		const data_changed = fields_changes.length > 0 || content_changes.length > 0
		if (code_changed || data_changed) {
			const proceed = window.confirm('Unsaved changes will be lost. Continue?')
			return proceed
		} else return true
	}}
	icon="lucide:blocks"
	title={symbol.name || 'Block'}
	button={{
		...header.button,
		onclick: save_component,
		icon: 'material-symbols:save',
		disabled: $has_error
	}}
>
	{#snippet left()}
		<div>
			{#if $userRole === 'DEV'}
				<LargeSwitch
					tabs={[
						{
							id: 'code',
							icon: 'gravity-ui:code'
						},
						{
							id: 'content',
							icon: 'uil:edit'
						}
					]}
					bind:active_tab_id={tab}
				/>
			{/if}
		</div>
	{/snippet}
</ModalHeader>

<main class:showing-fields={tab === 'fields'} lang={$locale}>
	<PaneGroup direction={$orientation} style="display: flex; gap: 0.25rem;">
		<Pane defaultSize={50} style="display: flex; flex-direction: column;">
			{#if tab === 'code'}
				<FullCodeEditor bind:html={raw_html} bind:css={raw_css} bind:js={raw_js} data={_.cloneDeep(component_data)} on:save={save_component} on:mod-e={() => {}} />
			{:else if tab === 'content'}
				<Fields
					id="section-{component.id}"
					fields={local_fields}
					entries={local_content}
					{fields_changes}
					{content_changes}
					on:input={({ detail }) => {
						local_fields = detail.fields
						local_content = detail.entries
						fields_changes = detail.changes.fields
						content_changes = detail.changes.entries
						update_component_data()
					}}
					onkeydown={handle_hotkey}
				/>
			{/if}
		</Pane>
		<PaneResizer class="PaneResizer" />
		<Pane defaultSize={50}>
			<ComponentPreview
				code={{
					html: raw_html,
					css: raw_css,
					js: raw_js
				}}
				data={_.cloneDeep(component_data)}
				bind:orientation={$orientation}
				view="small"
				{loading}
			/>
		</Pane>
	</PaneGroup>
</main>

<style lang="postcss">
	main {
		display: flex; /* to help w/ positioning child items in code view */
		background: var(--primo-color-black);
		color: var(--color-gray-2);
		padding: 0 0.5rem;
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
