<script>
	import { onDestroy } from 'svelte'
	import '@fontsource/fira-code/index.css'
	import _ from 'lodash-es'
	import Icon, { loadIcons, enableCache } from '@iconify/svelte'
	import { browser } from '$app/environment'
	import IconButton from './ui/IconButton.svelte'
	import Toolbar from './views/editor/Toolbar.svelte'
	import Modal from './views/modal/ModalContainer.svelte'
	import modal from './stores/app/modal'
	import * as modals from './views/modal'
	import * as Mousetrap from 'mousetrap'
	import hotkey_events from './stores/app/hotkey_events'
	import { onMobile, mod_key_held } from './stores/app/misc'
	import built_in_symbols from './stores/data/primo_symbols'
	import Page_Sidebar from './components/Sidebar/Page_Sidebar.svelte'
	import PageType_Sidebar from './components/Sidebar/PageType_Sidebar.svelte'
	import { userRole } from './stores/app/index.js'
	import { hydrate_active_data } from './stores/hydration.js'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import { site_design_css } from '$lib/builder/code_generators.js'
	import { site_html, page_html } from '$lib/builder/stores/app/page'
	import { design as siteDesign, code as siteCode } from '$lib/builder/stores/data/site.js'
	import { processCode } from '$lib/builder/utils.js'
	import { get_page_data, get_site_data } from '$lib/builder/stores/helpers.js'
	import active_page from '$lib/builder/stores/data/page.js'
	import page_type from '$lib/builder/stores/data/page_type.js'
	import { afterNavigate } from '$app/navigation'

	/**
	 * @typedef {Object} Props
	 * @property {any} data
	 * @property {string} [role] - $: console.log({ data })
	 * @property {any} [primary_buttons]
	 * @property {any} [dropdown]
	 * @property {any} [secondary_buttons]
	 * @property {any} [primo_symbols]
	 * @property {import('svelte').Snippet} [toolbar]
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { data, role = 'DEV', primary_buttons = [], dropdown = [], secondary_buttons = [], primo_symbols = [], toolbar, children } = $props()

	$inspect({ data })

	hydrate_active_data(data)

	function getActiveModal(modalType) {
		return modalType
			? {
					SITE_PAGES: modals.SitePages,
					SECTION_EDITOR: modals.SectionEditor,
					BLOCK_EDITOR: modals.BlockEditor,
					SITE_EDITOR: modals.SiteEditor
				}[modalType] || $modal.component
			: null
	}

	let showing_sidebar = $state(true)

	function reset() {
		showing_sidebar = true
		sidebar_pane.resize(20)
	}

	// Preload icons
	loadIcons([
		'mdi:icon',
		'bxs:duplicate',
		'ic:baseline-edit',
		'ic:baseline-download',
		'ic:outline-delete',
		'bsx:error',
		'mdi:plus',
		'mdi:upload',
		'fa-solid:plus',
		'carbon:close',
		'material-symbols:drag-handle-rounded',
		'ph:caret-down-bold',
		'ph:caret-up-bold',
		'charm:layout-rows',
		'charm:layout-columns',
		'bx:refresh',
		'uil:image-upload',
		'mdi:arrow-up',
		'mdi:arrow-down',
		'ion:trash',
		'akar-icons:plus',
		'akar-icons:check',
		'mdi:chevron-down',
		'ic:round-code',
		'eos-icons:loading',
		'material-symbols:code',
		'fluent:form-multiple-24-regular',
		'gg:website',
		'fluent:library-28-filled',
		'lsicon:marketplace-filled'
	])
	enableCache('local')

	// listen for Cmd/Ctrl key to show key hint
	if (browser) {
		Mousetrap.bind('mod', () => ($mod_key_held = true), 'keydown')
		Mousetrap.bind('mod', () => ($mod_key_held = false), 'keyup')
		// sometimes keyup doesn't fire
		window.addEventListener('mousemove', _.throttle(handle_mouse_move, 100))
		function handle_mouse_move(e) {
			if (!e.metaKey && $mod_key_held) {
				$mod_key_held = false
			}
		}

		Mousetrap.bind(['mod+1'], (e) => {
			e.preventDefault()
			hotkey_events.dispatch('tab-switch', 1)
		})
		Mousetrap.bind(['mod+2'], (e) => {
			e.preventDefault()
			hotkey_events.dispatch('tab-switch', 2)
		})
		Mousetrap.bind(['mod+3'], (e) => {
			e.preventDefault()
			hotkey_events.dispatch('tab-switch', 3)
		})
		Mousetrap.bind('escape', (e) => {
			hotkey_events.dispatch('escape')
		})
		Mousetrap.bind('mod+s', (e) => {
			e.preventDefault()
			hotkey_events.dispatch('save')
		})
		Mousetrap.bind('mod+up', (e) => {
			e.preventDefault()
			hotkey_events.dispatch('up')
		})
		Mousetrap.bind('mod+down', (e) => {
			e.preventDefault()
			hotkey_events.dispatch('down')
		})
		Mousetrap.bind('mod+e', (e) => {
			console.log('dispatching e')
			e.preventDefault()
			hotkey_events.dispatch('e')
		})
	}

	let sidebar_pane = $state()
	$effect.pre(() => {
		$userRole = role
		$built_in_symbols = primo_symbols
		hydrate_active_data(data)
	})
	let activeModal = $derived(getActiveModal($modal.type))

	// Generate <head> tag code
	let previous
	$effect.pre(() => {
		if (previous === $siteCode.head + $siteDesign) return
		compile_component_head(`<svelte:head>${$siteCode.head + site_design_css($siteDesign)}</svelte:head>`).then((generated_code) => {
			$site_html = generated_code
			previous = $siteCode.head + $siteDesign
		})
	})

	// reset site html to avoid issues when navigating to new site
	onDestroy(() => {
		$site_html = null
	})

	async function compile_component_head(site) {
		const compiled = await processCode({
			component: {
				html: site,
				css: '',
				js: '',
				data: get_site_data({})
			}
		})
		if (!compiled.error) {
			return compiled.head
		} else return ''
	}
</script>

<div class="h-screen flex flex-col">
	<Toolbar {primary_buttons} {dropdown} {secondary_buttons} on:publish>
		{@render toolbar?.()}
	</Toolbar>
	<PaneGroup direction="horizontal" autoSaveId="page-view" style="height:initial;flex:1;">
		<Pane
			bind:pane={sidebar_pane}
			defaultSize={20}
			minSize={2}
			onResize={(size) => {
				if (size < 10) {
					showing_sidebar = false
					sidebar_pane.resize(2)
				} else {
					showing_sidebar = true
				}
			}}
		>
			{#if showing_sidebar}
				{#if data.page_type}
					<PageType_Sidebar />
				{:else}
					<Page_Sidebar />
				{/if}
			{:else if !$onMobile}
				<div class="expand primo-reset">
					<IconButton onclick={reset} icon="tabler:layout-sidebar-left-expand" />
				</div>
			{/if}
		</Pane>
		<PaneResizer
			class="PaneResizer"
			style="display: flex;
			align-items: center;
			justify-content: center;"
		>
			{#if showing_sidebar}
				<span class="grab-handle">
					<Icon icon="octicon:grabber-16" />
				</span>
			{/if}
		</PaneResizer>
		<Pane class="relative bg-white" defaultSize={80}>
			{@render children?.()}
		</Pane>
	</PaneGroup>
</div>

<Modal visible={!!activeModal}>
	{@const SvelteComponent = activeModal}
	<SvelteComponent {...$modal.componentProps} />
</Modal>

<svelte:window onresize={reset} />

<style lang="postcss">
	.expand {
		height: 100%;
		color: var(--color-gray-1);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gray-9);
	}
	.grab-handle {
		color: #222;
		padding-block: 3px;
		background: var(--primo-color-brand);
		z-index: 99;
		border-radius: 1px;
		font-size: 10px;
	}
</style>
