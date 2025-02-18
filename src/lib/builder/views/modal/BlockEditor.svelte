<script module>
	import { writable, get } from 'svelte/store'
	const orientation = writable('horizontal')
</script>

<script>
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import LargeSwitch from '$lib/builder/ui/LargeSwitch.svelte'
	import _, { chain as _chain } from 'lodash-es'
	import ModalHeader from './ModalHeader.svelte'
	import FullCodeEditor from './SectionEditor/FullCodeEditor.svelte'
	import ComponentPreview, { has_error } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields from '$lib/builder/components/Fields/FieldsContent.svelte'
	import { locale, onMobile, userRole } from '$lib/builder/stores/app/misc.js'
	import { Symbol } from '$lib/builder/factories.js'
	import { get_content_with_synced_values } from '$lib/builder/stores/helpers.js'
	import hotkey_events from '$lib/builder/stores/app/hotkey_events.js'
	import site from '$lib/builder/stores/data/site.js'

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Symbol} [block]
	 * @property {string} [tab]
	 * @property {any} [header]
	 */

	/** @type {Props} */
	let {
		block = Symbol(),
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

	let local_code = _.cloneDeep(block.code)
	let local_fields = $state(_.cloneDeep(block.fields))
	let local_entries = $state(_.cloneDeep([...block.entries, ...$site.entries]))

	let loading = false

	// raw code bound to code editor
	let raw_html = $state(local_code.html)
	let raw_css = $state(local_code.css)
	let raw_js = $state(local_code.js)

	let component_data = $derived(
		get_content_with_synced_values({
			entries: local_entries.filter((e) => !e.site && !e.page),
			fields: local_fields,
			site: { ...$site, entries: local_entries.filter((e) => e.site) }
		})[$locale]
	)

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
		if (!$has_error) {
			console.log({ local_code })
			header.button.onclick({
				code: {
					html: raw_html,
					css: raw_css,
					js: raw_js
				},
				entries: local_entries,
				fields: local_fields
			})
		}
	}
</script>

<ModalHeader
	{...header}
	warn={() => {
		const original_entries = [...block.entries, ...$site.entries]
		const code_changed = !_.isEqual(block.code, { html: raw_html, css: raw_css, js: raw_js })
		const data_changed = !_.isEqual(original_entries, local_entries) || !_.isEqual(block.fields, local_fields)
		if (code_changed || data_changed) {
			const proceed = window.confirm('Unsaved changes will be lost. Continue?')
			return proceed
		} else return true
	}}
	icon="lucide:blocks"
	title={block.name || 'Block'}
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
				<LargeSwitch bind:active_tab_id={tab} />
			{/if}
		</div>
	{/snippet}
</ModalHeader>

<main lang={$locale}>
	<PaneGroup direction={$orientation} style="display: flex;">
		<Pane defaultSize={50}>
			{#if tab === 'code'}
				<FullCodeEditor bind:html={raw_html} bind:css={raw_css} bind:js={raw_js} data={component_data} on:save={save_component} on:mod-e={toggle_tab} />
			{:else if tab === 'content'}
				<Fields
					id={block.id}
					fields={local_fields}
					entries={local_entries}
					on:input={({ detail }) => {
						local_fields = detail.fields
						local_entries = detail.entries
					}}
					onkeydown={handle_hotkey}
				/>
			{/if}
		</Pane>
		<PaneResizer class="PaneResizer" />
		<Pane defaultSize={50}>
			<ComponentPreview
				bind:orientation={$orientation}
				view="small"
				{loading}
				code={{
					html: raw_html,
					css: raw_css,
					js: raw_js
				}}
				data={component_data}
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
</style>
