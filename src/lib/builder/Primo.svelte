<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte'
	import * as _ from 'lodash-es'
	import Icon, { loadIcons } from '@iconify/svelte'
	import IconButton from './ui/IconButton.svelte'
	import Toolbar from './views/editor/Toolbar.svelte'
	import { PressedKeys } from 'runed'
	import { isModKeyPressed } from './utils/keyboard'
	import { onMobile, mod_key_held, locale } from './stores/app/misc'
	import Page_Sidebar from './components/Sidebar/Page_Sidebar.svelte'
	import PageType_Sidebar from './components/Sidebar/PageType_Sidebar.svelte'
	import { sidebarReveal } from './stores/app/outline'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import { site_html } from '$lib/builder/stores/app/page'
	import { processCode } from '$lib/builder/utils'
	import { page } from '$app/state'
	import type { Sites } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { site_context } from './stores/context'
	import { useContent } from '$lib/Content.svelte'
	import { fromStore } from 'svelte/store'
	import { current_user } from '$lib/pocketbase/user'
	import { read_only } from '$lib/pocketbase/author_mode'
	import { toast } from 'svelte-sonner'
	import { setUserActivity } from '$lib/UserActivity.svelte'

	let {
		site,
		toolbar,
		children
	}: {
		site: ObjectOf<typeof Sites>
		toolbar?: Snippet
		children?: Snippet
	} = $props()

	// Set context so child components can access the site
	const context = $state({ value: site })
	site_context.set(context)
	$effect(() => {
		context.value = site

		if (!site_data) return
		compile_component_head({ html: site.head, data: site_data }).then((generated_code) => {
			$site_html = generated_code
		})
	})

	const user = fromStore(current_user).current
	if (!user) {
		throw new Error('No current user')
	} else {
		setUserActivity({ user: user.id, site: site.id })
	}

	let showing_sidebar = $state(true)
	let mobile_sidebar_open = $state(false)

	$effect(() => {
		const request = $sidebarReveal
		if (request) untrack(() => {
			showing_sidebar = true
			mobile_sidebar_open = true
			if (window.matchMedia('(min-width: 641px)').matches) sidebar_pane?.resize(30)
		})
	})

	function reset() {
		showing_sidebar = true
		// sidebar_pane?.resize(20)
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

	// Initialize keyboard tracking
	const keys = new PressedKeys()

	// Track Cmd/Ctrl key to show key hint
	$effect(() => {
		$mod_key_held = isModKeyPressed(keys)
	})

	let sidebar_pane = $state<ReturnType<typeof Pane>>()

	// reset site html to avoid issues when navigating to new site
	onDestroy(() => {
		$site_html = null
	})

	const data = $derived(useContent(site, { target: 'cms' }))
	const site_data = $derived(data && (data[$locale] ?? {}))
	async function compile_component_head({ html, data }) {
		const compiled = await processCode({
			component: {
				html: `<svelte:head>${html}</svelte:head>`,
				css: '',
				js: '',
				data: data ?? {}
			}
		})
		if (!compiled.error) {
			return compiled.head
		} else return ''
	}

	// Generate <head> tag code – only when site data meaningfully changes
	let last_site_data = $state<any>()
	$effect(() => {
		if (!site_data) return

		// Skip recompilation if data is effectively unchanged
		if (_.isEqual(last_site_data, site_data)) return

		last_site_data = _.cloneDeep(site_data)
		compile_component_head({ html: site.head, data: site_data }).then((generated_code) => {
			$site_html = generated_code
		})
	})

	// --- Browse mode safety net ---------------------------------------------
	// Fields and controls are rendered read-only at the source in files mode.
	// This capture-phase interceptor exists only to catch edit paths that slip
	// through (a field type that forgets to pass `readonly`, a third-party
	// widget, a paste handler). Prefer fixing the component over relying on it.

	let last_toast_at = 0
	function warn_read_only() {
		// Typing fires an event per keystroke; throttle so we show one toast.
		const now = Date.now()
		if (now - last_toast_at < 3000) return
		last_toast_at = now
		toast('Files are authoritative — edit the file locally, or restart with --author cms.')
	}

	// Keys that only move the caret or copy; blocking them would break the
	// "selectable and copyable" requirement.
	const non_mutating_keys = new Set([
		'Tab',
		'Escape',
		'Enter',
		'ArrowLeft',
		'ArrowRight',
		'ArrowUp',
		'ArrowDown',
		'Home',
		'End',
		'PageUp',
		'PageDown',
		'Shift',
		'Control',
		'Alt',
		'Meta',
		'CapsLock'
	])

	function is_editable_target(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false
		if (target.isContentEditable) return true
		if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled
		if (target instanceof HTMLInputElement) return !target.readOnly && !target.disabled
		return false
	}

	function onbeforeinputcapture(event: InputEvent) {
		if (!$read_only) return
		if (!is_editable_target(event.target)) return
		event.preventDefault()
		event.stopPropagation()
		warn_read_only()
	}

	function oninputcapture(event: Event) {
		if (!$read_only) return
		if (!is_editable_target(event.target)) return
		event.stopPropagation()
		warn_read_only()
	}

	function onkeydowncapture(event: KeyboardEvent) {
		if (!$read_only) return
		if (!is_editable_target(event.target)) return
		// Let copy/select-all and other mod-key shortcuts through.
		if (event.metaKey || event.ctrlKey) return
		if (non_mutating_keys.has(event.key)) return
		event.preventDefault()
		event.stopPropagation()
		warn_read_only()
	}
</script>

<div class="h-screen flex flex-col" {oninputcapture} {onkeydowncapture} {onbeforeinputcapture}>
	<Toolbar>
		{@render toolbar?.()}
	</Toolbar>
	<button class="mobile-sidebar-bar" aria-expanded={mobile_sidebar_open} aria-controls="editor-sidebar" onclick={() => (mobile_sidebar_open = !mobile_sidebar_open)}>
		<Icon icon="tabler:layout-sidebar-left-expand" />
		{mobile_sidebar_open ? 'Hide sidebar' : 'Show sidebar'}
	</button>
	<PaneGroup class="editor-panes" direction="horizontal" autoSaveId="page-view" style="height:initial;flex:1;">
		<Pane
			id="editor-sidebar"
			class={mobile_sidebar_open ? 'editor-sidebar mobile-open' : 'editor-sidebar'}
			bind:this={sidebar_pane}
			defaultSize={20}
			minSize={2}
			onResize={(size) => {
				if (size < 10) {
					showing_sidebar = false
					sidebar_pane?.resize(2)
				} else {
					showing_sidebar = true
				}
			}}
		>
			{#if showing_sidebar || mobile_sidebar_open}
				{#if page.params.page_type}
					<PageType_Sidebar />
				{:else}
					<Page_Sidebar />
				{/if}
			{:else if !$onMobile}
				<div class="expand">
					<IconButton
						onclick={() => {
							reset()
							sidebar_pane?.resize(20)
						}}
						icon="tabler:layout-sidebar-left-expand"
					/>
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
		<Pane class="editor-canvas relative bg-white" defaultSize={80}>
			{@render children?.()}
		</Pane>
	</PaneGroup>
</div>

<svelte:window onresize={reset} />

<style lang="postcss">
	.mobile-sidebar-bar { display: none; }
	@media (max-width: 640px) {
		.mobile-sidebar-bar { display: flex; align-items: center; gap: 7px; flex-shrink: 0; width: 100%; min-height: 44px; padding: 10px 18px; background: #1e1e20; border-bottom: 1px solid #343437; color: #ddd; font-size: 12px; text-align: left; cursor: pointer; }
		.mobile-sidebar-bar:hover { background: #262629; }
		.mobile-sidebar-bar:focus-visible { outline: 2px solid #956e51; outline-offset: -2px; }
		:global(.editor-panes) { flex-direction: column !important; min-height: 0; }
		:global(.editor-panes > .editor-sidebar) { display: none; }
		:global(.editor-panes > .editor-sidebar.mobile-open) { display: block; flex: 0 0 min(42vh, 320px) !important; width: 100%; min-height: 0; border-bottom: 1px solid #343437; }
		:global(.editor-panes > .PaneResizer) { display: none !important; }
		:global(.editor-panes > .editor-canvas) { flex: 1 1 0% !important; min-height: 0; width: 100%; }
	}

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
		background: var(--color-gray-6);
		z-index: 9;
		border-radius: 1px;
		font-size: 10px;
	}
</style>
