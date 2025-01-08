<script module>
	import { writable, get } from 'svelte/store'

	const leftPaneSize = writable(get(onMobile) ? '100%' : '50%')
	const rightPaneSize = writable('50%')
	const topPaneSize = writable(get(onMobile) ? '100%' : '50%')
	const bottomPaneSize = writable('50%')
	const orientation = writable('horizontal')
</script>

<script>
	import Icon from '@iconify/svelte'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import _, { cloneDeep, chain as _chain } from 'lodash-es'
	import { ComponentPreview } from '$lib/builder/components'
	import { onMobile } from '$lib/builder/stores/app'
	// import { sites } from '../../../actions'
	import active_site from '$lib/builder/actions/active_site'
	import { page } from '$app/stores'
	import { site } from '$lib/builder/stores/data/site'
	import UI from '$lib/builder/ui'
	import * as code_generators from '$lib/builder/code_generators'
	import DesignFields from './DesignFields.svelte'
	import ModalHeader from '$lib/components/ModalHeader.svelte'

	const local_design_values = cloneDeep($site.design)
	let design_variables_css = $state(code_generators.site_design_css(local_design_values))

	let loading = $state(false)

	function update_design_variables_css() {
		design_variables_css = code_generators.site_design_css(local_design_values)
	}

	let preview = $state('')
	compile_page_preview()

	let compilationError // holds compilation error

	let disableSave = false
	async function compile_page_preview() {
		loading = true

		await compile()
		await setTimeout(() => {
			loading = false
		}, 200)

		async function compile() {
			preview = (await code_generators.page_html({ no_js: true, site: { ...$page.data.site, design: local_design_values } }))?.html
			previewUpToDate = true
		}
	}

	let previewUpToDate = $state(false)
	$effect(() => {
		design_variables_css, (previewUpToDate = false)
	}) // reset when code changes

	async function saveComponent() {
		if (!disableSave) {
			active_site.update({
				design: local_design_values
			})
		}
	}
</script>

<ModalHeader
	icon="solar:pallete-2-bold"
	title="Design"
	warn={() => {
		// if (!isEqual(local_component, component)) {
		//   const proceed = window.confirm(
		//     'Undrafted changes will be lost. Continue?'
		//   )
		//   return proceed
		// } else return true
		return true
	}}
	button={{
		icon: 'material-symbols:save',
		label: 'Save',
		onclick: saveComponent,
		disabled: false
	}}
/>
<main>
	<PaneGroup direction="horizontal" style="display: flex; height: 100vh; max-height: calc(100vh - 42px)" autoSaveId="design-panel">
		<Pane defaultSize={50} minSize={20}>
			<div
				style="
	height: calc(100% - 3rem);
	overflow: auto;
	--label-font-size: 0.875rem;
	--label-font-weight: 400;
	--DesignPanel-brand-color: {local_design_values['brand_color']};;
	--DesignPanel-font-heading: {local_design_values['heading_font']};;
	--DesignPanel-border-radius: {local_design_values['roundness']};
	"
			>
				<DesignFields values={local_design_values} on:input={update_design_variables_css} />
			</div>
		</Pane>
		<PaneResizer
			class="PaneResizer"
			style="display: flex;
			align-items: center;
			justify-content: center;"
		>
			<span class="grab-handle">
				<Icon icon="octicon:grabber-16" />
			</span>
		</PaneResizer>
		<Pane defaultSize={50}>
			<ComponentPreview bind:orientation={$orientation} view="small" {loading} append={design_variables_css} {preview} error={compilationError} />
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
		width: 100%;

		--Button-bg: var(--color-gray-8);
		--Button-bg-hover: var(--color-gray-9);
	}

	[slot='right'] {
		width: 100%;
	}

	[slot='left'] {
		/* height: calc(100% - 45px); */
		height: 100%;

		display: flex;
		flex-direction: column;
	}

	.grab-handle {
		padding-block: 3px;
		color: #222;
		background: var(--primo-color-brand);
		z-index: 99;
		border-radius: 1px;
		font-size: 10px;
	}
</style>
