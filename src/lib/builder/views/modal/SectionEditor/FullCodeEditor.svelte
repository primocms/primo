<script module>
	import { writable } from 'svelte/store'

	const left_pane_size = writable(33)
	const center_pane_size = writable(33)
	const right_pane_size = writable(33)

	const activeTabs = writable({
		html: true,
		css: true,
		js: true
	})

	const CodeMirror = writable(null)
	if (!import.meta.env.SSR) {
		import('../../../components/CodeEditor/CodeMirror.svelte').then((module) => {
			CodeMirror.set(module.default)
			fetch_dev_libraries()
		})
	}

	let libraries
	async function fetch_dev_libraries() {
		libraries = {
			prettier: await import('$lib/builder/libraries/prettier/prettier'),
			prettier_css: (await import('$lib/builder/libraries/prettier/parser-postcss')).default,
			prettier_babel: (await import('$lib/builder/libraries/prettier/parser-babel')).default,
			prettier_svelte: (await import('$lib/builder/libraries/prettier/prettier-svelte')).default
		}
	}
</script>

<script>
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import { onMobile } from '../../../stores/app/misc'

	/**
	 * @typedef {Object} Props
	 * @property {any} [data]
	 * @property {string} [html]
	 * @property {string} [css]
	 * @property {string} [js]
	 */

	/** @type {Props} */
	let { data = {}, html = $bindable(''), css = $bindable(''), js = $bindable('') } = $props()

	let html_pane = $state()
	let css_pane = $state()
	let js_pane = $state()

	let selections = $state({
		html: 0,
		css: 0,
		js: 0
	})

	function toggleTab(tab) {
		const tabName = {
			0: 'html',
			1: 'css',
			2: 'js'
		}[tab]
		$activeTabs = {
			...$activeTabs,
			[tabName]: !$activeTabs[tabName]
		}

		const nActive = Object.values($activeTabs).filter(Boolean).length
		if (!nActive) return
		const panelWidth = 100 / nActive

		$left_pane_size = $activeTabs['html'] ? panelWidth : 4
		$center_pane_size = $activeTabs['css'] ? panelWidth : 4
		$right_pane_size = $activeTabs['js'] ? panelWidth : 4

		html_pane?.resize($left_pane_size)
		css_pane?.resize($center_pane_size)
		js_pane?.resize($right_pane_size)
	}

	// close empty tabs
	if (!css && $activeTabs['css']) {
		toggleTab(1)
	}
	if (!js && $activeTabs['js']) {
		toggleTab(2)
	}

	let showing_format_button = $state(true)
	async function format_all_code() {
		html = format(html, 'svelte', libraries.prettier_svelte)
		css = format(css, 'css', libraries.prettier_css)
		js = format(js, 'babel', libraries.prettier_babel)
	}

	function format(code, mode, plugin) {
		let formatted
		try {
			formatted = libraries.prettier.format(code, {
				parser: mode,
				// bracketSameLine: true,
				plugins: [plugin]
			})
		} catch (e) {
			console.warn(e)
		}
		return formatted
	}

	let showing_local_key_hint = $state(false)
</script>

<PaneGroup direction="horizontal" class="flex h-full" autoSaveId="page-view">
	<Pane
		bind:pane={html_pane}
		minSize={4}
		onResize={(size) => {
			$left_pane_size = size
		}}
	>
		<div class="tabs">
			<button class:tab-hidden={$left_pane_size <= 5} onclick={() => toggleTab(0)}>
				{#if showing_local_key_hint}
					<span class="vertical">&#8984; 1</span>
				{:else}
					<span>HTML</span>
				{/if}
			</button>
			{#if $CodeMirror}
				{@const SvelteComponent_3 = $CodeMirror}
				<SvelteComponent_3
					mode="html"
					docs="https://docs.primo.so/development#html"
					{data}
					bind:value={html}
					bind:selection={selections['html']}
					on:modkeydown={() => (showing_local_key_hint = true)}
					on:modkeyup={() => (showing_local_key_hint = false)}
					on:tab-switch={({ detail }) => toggleTab(detail)}
					on:change={() => {
						dispatch('htmlChange')
					}}
					on:format={() => (showing_format_button = false)}
					on:save
					on:refresh
				/>
			{/if}
		</div>
	</Pane>
	<PaneResizer
		class="PaneResizer"
		style="display: flex;
		align-items: center;
		justify-content: center;"
	>
		<span class="grab-handle">
			<Icon icon="mdi:drag-vertical-variant" />
		</span>
	</PaneResizer>
	<Pane
		minSize={4}
		style="position: relative;"
		onResize={(size) => {
			$center_pane_size = size
		}}
	>
		<div class="tabs">
			<button class:tab-hidden={$center_pane_size <= 5} onclick={() => toggleTab(1)}>
				{#if showing_local_key_hint}
					<span class="vertical">&#8984; 2</span>
				{:else}
					<span>CSS</span>
				{/if}
			</button>
			{#if $CodeMirror}
				{@const SvelteComponent_4 = $CodeMirror}
				<SvelteComponent_4
					on:modkeydown={() => (showing_local_key_hint = true)}
					on:modkeyup={() => (showing_local_key_hint = false)}
					on:tab-switch={({ detail }) => toggleTab(detail)}
					bind:selection={selections['css']}
					bind:value={css}
					mode="css"
					docs="https://docs.primo.so/development#css"
					on:change={() => {
						// showing_format_button = true
						dispatch('cssChange')
					}}
					on:format={() => (showing_format_button = false)}
					on:save
					on:refresh
				/>
			{/if}
		</div>
	</Pane>
	<PaneResizer
		bind:pane={css_pane}
		class="PaneResizer"
		style="display: flex;
		align-items: center;
		justify-content: center;"
	>
		<span class="grab-handle">
			<Icon icon="mdi:drag-vertical-variant" />
		</span>
	</PaneResizer>
	<Pane
		minSize={4}
		bind:pane={js_pane}
		style="position: relative;"
		onResize={(size) => {
			$right_pane_size = size
		}}
	>
		<div class="tabs">
			<button class:tab-hidden={$right_pane_size <= 5} onclick={() => toggleTab(2)}>
				{#if showing_local_key_hint}
					<span class="vertical">&#8984; 3</span>
				{:else}
					<span>JS</span>
				{/if}
			</button>
			{#if $CodeMirror}
				{@const SvelteComponent_5 = $CodeMirror}
				<SvelteComponent_5
					on:modkeydown={() => (showing_local_key_hint = true)}
					on:modkeyup={() => (showing_local_key_hint = false)}
					on:tab-switch={({ detail }) => toggleTab(detail)}
					bind:selection={selections['js']}
					bind:value={js}
					mode="javascript"
					docs="https://docs.primo.so/development#javascript"
					on:change={() => {
						// showing_format_button = true
						dispatch('jsChange')
					}}
					on:format={() => (showing_format_button = false)}
					on:save
					on:refresh
				/>
			{/if}
		</div>
	</Pane>
</PaneGroup>

<!-- <footer>
	{#if showing_format_button}
		<button onclick={() => format_all_code()} transition:fade|local={{ duration: 100 }}>
			<Icon icon="carbon:clean" />
			<span>Format</span>
		</button>
	{/if}
	<a target="blank" href={'https://docs.primocms.org/development'}>
		<span>Docs</span>
		<Icon icon="mdi:external-link" />
	</a>
</footer> -->

<style lang="postcss">
	[slot] {
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.mobile-tabs {
		display: flex;
		flex-direction: column;
		overflow: scroll;

		ul {
			color: var(--color-gray-2);
			border: 1px solid var(--color-gray-9);
		}
	}

	.tabs {
		width: 100%;
		height: 100%;
		position: relative;

		button {
			background: var(--color-gray-9);
			color: var(--primo-color-white);
			width: 100%;
			text-align: center;
			padding: 8px 0;
			outline: 0;
			font-size: var(--font-size-1);
			/* font-weight: 700; */
			z-index: 10;

			&.tab-hidden {
				height: 100%;
				position: absolute;
				background: #111;
				transition:
					background 0.1s,
					color 0.1s;

				&:hover {
					background: var(--weave-primary-color);
					color: var(--primo-color-codeblack);
				}

				span {
					transform: rotate(270deg);
					display: block;
				}

				span.vertical {
					transform: initial;
				}
			}
		}
	}

	footer {
		position: sticky;
		bottom: 0.25rem;
		left: 100%;
		margin-right: 0.25rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.25rem;
		z-index: 99;
		pointer-events: none;

		a,
		button {
			color: var(--color-gray-2);
			background: var(--color-gray-9);
			transition: 0.1s background;
			padding: 0.25rem 0.5rem;
			font-size: 0.75rem;
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			pointer-events: all;

			&:hover {
				background: var(--color-gray-8);
			}
		}
	}
</style>
