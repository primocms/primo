<script lang="ts">
	import axios from 'axios'
	import _ from 'lodash-es'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import FullCodeEditor from '$lib/builder/views/modal/SectionEditor/FullCodeEditor.svelte'
	import ComponentPreview, { has_error } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields from '$lib/builder/components/Fields/FieldsContent.svelte'
	import LargeSwitch from '$lib/builder/ui/LargeSwitch.svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Symbol } from '$lib/builder/factories'
	import { transform_content } from '$lib/builder/transform_data'
	import { static_iframe_srcdoc } from '$lib/builder/components/misc'
	import { block_html } from '$lib/builder/code_generators.js'

	let { symbol = Symbol(), onsubmit, head = '', append = '' } = $props()

	let local_html = $state(symbol.code.html)
	let local_css = $state(symbol.code.css)
	let local_js = $state(symbol.code.js)

	let fields_changes = $state([])
	let content_changes = $state([])

	let local_fields = $state(symbol.fields)
	let local_entries = $state(symbol.entries)

	let component_data = $derived(
		transform_content({
			entries: local_entries,
			fields: local_fields
		})['en']
	)

	let tab = $state('code')
	function toggle_tab() {
		tab = tab === 'code' ? 'content' : 'code'
	}

	// detect hotkeys from within inputs
	function handle_hotkey(e) {
		const { metaKey, key } = e
		if (metaKey && key === 's') {
			e.preventDefault()
			onsave()
		}
		if (metaKey && key === 'e') {
			e.preventDefault()
			toggle_tab()
		}
	}

	let loading = $state(false)
	async function onsave() {
		const code = {
			html: local_html,
			css: local_css,
			js: local_js
		}
		const generate_code = await block_html({ code, data: component_data })
		const preview = static_iframe_srcdoc(generate_code)
		loading = true
		onsubmit({
			code,
			changes: {
				fields: fields_changes,
				entries: content_changes
			},
			preview
		})
	}
</script>

<Dialog.Header
	class="mb-2"
	title="Create Block"
	button={{
		label: 'Done',
		onclick: onsave,
		loading,
		disabled: $has_error
	}}
>
	<LargeSwitch bind:active_tab_id={tab} />
</Dialog.Header>

<div class="max-h-[91vh] flex-1">
	<PaneGroup direction="horizontal">
		<Pane defaultSize={50}>
			{#if tab === 'code'}
				<FullCodeEditor bind:html={local_html} bind:css={local_css} bind:js={local_js} data={component_data} on:save={onsave} on:mod-e={toggle_tab} />
			{:else if tab === 'content'}
				<Fields
					id={'placeholder'}
					fields={local_fields}
					entries={local_entries}
					{fields_changes}
					{content_changes}
					on:input={({ detail }) => {
						local_fields = detail.fields
						local_entries = detail.entries
						fields_changes = detail.changes.fields
						content_changes = detail.changes.entries
					}}
					onkeydown={handle_hotkey}
				/>
			{/if}
		</Pane>
		<PaneResizer class="PaneResizer" />
		<Pane defaultSize={50}>
			<ComponentPreview
				view="small"
				{loading}
				{head}
				{append}
				code={{
					html: local_html,
					css: local_css,
					js: local_js
				}}
				data={component_data}
			/>
		</Pane>
	</PaneGroup>
</div>
