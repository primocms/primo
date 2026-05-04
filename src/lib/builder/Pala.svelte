<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte'
	import * as _ from 'lodash-es'
	import Icon, { loadIcons } from '@iconify/svelte'
	import IconButton from './ui/IconButton.svelte'
	import Toolbar from './views/editor/Toolbar.svelte'
	import { PressedKeys } from 'runed'
	import { isModKeyPressed } from './utils/keyboard'
	import { onMobile, mod_key_held, locale } from './stores/app/misc'
	import Page_Sidebar from './components/Sidebar/Page_Sidebar.svelte'
	import PageType_Sidebar from './components/Sidebar/PageType_Sidebar.svelte'
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
	import { author_mode } from '$lib/pocketbase/author_mode'
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
</script>

<div class="h-screen flex flex-col">
	{#if $author_mode === 'files'}
		<div class="files-mode-banner" role="status">
			<strong>Read-only.</strong>
			<span>Files are authoritative this session — edits made here will be discarded on the next sync. Restart with</span>
			<code>primo dev --author cms</code>
			<span>to author from the CMS.</span>
		</div>
	{/if}
	<Toolbar>
		{@render toolbar?.()}
	</Toolbar>
	<PaneGroup direction="horizontal" autoSaveId="page-view" style="height:initial;flex:1;">
		<Pane
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
			{#if showing_sidebar}
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
		<Pane class="relative bg-white" defaultSize={80}>
			{@render children?.()}
		</Pane>
	</PaneGroup>
</div>

<svelte:window onresize={reset} />

<style lang="postcss">
	.files-mode-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.75rem;
		background: #3a2a08;
		color: #fcd9a3;
		border-bottom: 1px solid #5a3f12;
		font-family: Inter, system-ui, sans-serif;
		font-size: 0.8125rem;
		line-height: 1.2;
		z-index: 100;
	}
	.files-mode-banner code {
		background: rgba(0, 0, 0, 0.3);
		padding: 1px 6px;
		border-radius: 3px;
		font-family: 'Fira Code', monospace;
		font-size: 0.75rem;
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
