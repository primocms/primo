<script module>
	import { writable } from 'svelte/store'
	export const has_error = writable(true)

	export const autoRefresh = writable(true)
	export const preview_updated = writable(true)
</script>

<script>
	import { onMount, tick } from 'svelte'
	import { slide, fade } from 'svelte/transition'
	import { dynamic_iframe_srcdoc } from './misc.js'
	import { locale, highlightedElement } from '../stores/app/misc'
	// import JSONTree from 'svelte-json-tree'
	import { JsonView } from '@zerodevx/svelte-json-view'
	import Icon from '@iconify/svelte'
	import { design as siteDesign, code as siteCode } from '$lib/builder/stores/data/site.js'
	import { site_design_css } from '$lib/builder/code_generators.js'
	import { get_site_data } from '$lib/builder/stores/helpers.js'
	import { content_editable } from '../utilities'
	import { processCode } from '../utils.js'

	/**
	 * @typedef {Object} Props
	 * @property {Object} [code]?
	 * @property {string} [view]?
	 * @property {string} [orientation]?
	 * @property {boolean} [loading]?
	 * @property {boolean} [hideControls]?
	 * @property {any} [preview]?
	 * @property {any} [data]
	 * @property {string} [append]?
	 */

	/** @type {Props} */
	let {
		code = {
			html: '',
			css: '',
			js: ''
		},
		view = $bindable('small'),
		orientation = $bindable('horizontal'),
		loading = $bindable(false),
		hideControls = false,
		preview = null,
		data = {},
		append = ''
	} = $props()

	$preview_updated = false

	let compilation_error = $state(null)

	let component_head_html = $state('')
	$effect.pre(() => {
		compile_component_head()
	})
	async function compile_component_head() {
		loading = true

		await compile()
		await setTimeout(() => {
			loading = false
		}, 200)

		async function compile() {
			const compiled_head = await processCode({
				component: {
					html: `<svelte:head>${$siteCode.head + site_design_css($siteDesign)}</svelte:head>`,
					css: '',
					js: '',
					data: get_site_data({})
				}
			})

			if (!compiled_head.error) {
				component_head_html = compiled_head.head
			}
		}
	}

	let componentApp = $state(null)
	async function compile_component_code(code) {
		if (!code.html) return
		// disable_save = true
		loading = true

		await compile()
		// disable_save = compilationError
		await setTimeout(() => {
			loading = false
		}, 200)

		async function compile() {
			const { js, error } = await processCode({
				component: {
					// head: code.head,
					html: code.html,
					css: code.css,
					js: code.js,
					data
				},
				buildStatic: false
			})

			if (error) {
				compilation_error = error
				$has_error = true
			} else {
				componentApp = js
				compilation_error = null
				$has_error = false
			}
		}
	}

	let channel
	onMount(() => {
		channel = new BroadcastChannel('component_preview')
		channel.onmessage = ({ data }) => {
			const { event, payload } = data
			if (event === 'BEGIN') {
				// reset log & runtime error
				consoleLog = null
				compilation_error = null
			} else if (event === 'SET_CONSOLE_LOGS') {
				consoleLog = data.payload.logs
			} else if (event === 'SET_ERROR') {
				compilation_error = data.payload.error
			} else if (event === 'SET_ELEMENT_PATH' && payload.loc) {
				$highlightedElement = payload.loc
			}
		}
	})

	let consoleLog = $state()

	let iframe = $state()

	function append_to_iframe(code) {
		var container = document.createElement('div')
		container.innerHTML = code
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.head.appendChild(node)
		})
	}

	let container = $state()
	let iframeLoaded = $state(false)

	let scale = $state()
	let height = $state()
	async function resizePreview() {
		if (view && container && iframe) {
			await tick()
			const { clientWidth: parentWidth } = container
			const { clientWidth: childWidth } = iframe
			const scaleRatio = parentWidth / childWidth
			scale = `scale(${scaleRatio})`
			height = 100 / scaleRatio + '%'
		}
	}

	function cycle_preview() {
		if (active_static_width === static_widths.phone) {
			set_preview(static_widths.tablet)
		} else if (active_static_width === static_widths.tablet) {
			set_preview(static_widths.laptop)
		} else if (active_static_width === static_widths.laptop) {
			set_preview(static_widths.desktop)
		} else {
			set_preview(static_widths.phone)
		}
		resizePreview()
	}

	function set_preview(size) {
		active_static_width = size
	}

	async function changeView() {
		if (view === 'small') {
			view = 'large'
			resizePreview()
		} else {
			view = 'small'
		}
	}

	function setIframeApp({ iframeLoaded, componentApp }) {
		if (iframeLoaded) {
			channel.postMessage({
				event: 'SET_APP',
				payload: { componentApp, data }
			})
		}
	}

	function setIframeData(data) {
		// if compilation error, try reloading app with updated data (i.e. error caused by missing field)
		if (compilation_error) {
			compile_component_code(code)
		}
		// reload the app if it crashed from an error
		const div = iframe?.contentDocument?.querySelector('div.component')
		if (div?.innerHTML === '') {
			setIframeApp({
				iframeLoaded,
				componentApp
			})
		} else if (iframeLoaded) {
			channel.postMessage({
				event: 'SET_APP_DATA',
				payload: { data }
			})
		}
	}

	function setLoading() {
		if (!iframeLoaded) {
			iframeLoaded = true
			return
		}
		iframeLoaded = false
		iframe.srcdoc = dynamic_iframe_srcdoc(component_head_html)
	}

	let previewWidth = $state()

	const static_widths = {
		phone: 300,
		tablet: 600,
		laptop: 1200,
		desktop: 1600
	}
	let active_static_width = $state(static_widths.laptop)

	function getIcon(width) {
		if (width < static_widths.tablet) {
			return 'bi:phone'
		} else if (width < static_widths.laptop) {
			return 'ant-design:tablet-outlined'
		} else if (width < static_widths.desktop) {
			return 'bi:laptop'
		} else {
			return 'akar-icons:desktop-device'
		}
	}

	function toggleOrientation() {
		if (orientation === 'vertical') {
			orientation = 'horizontal'
		} else if (orientation === 'horizontal') {
			orientation = 'vertical'
		}
	}
	$effect(() => {
		compile_component_code(code)
	})
	$effect(() => {
		if (iframe) {
			// open clicked links in browser
			iframe.contentWindow.document.querySelectorAll('a').forEach((link) => {
				link.target = '_blank'
			})
			append_to_iframe(append)
		}
	})
	$effect(() => {
		if (componentApp) {
			setIframeApp({
				iframeLoaded,
				componentApp
			})
		}
	})
	$effect(() => {
		setIframeData(data)
	})
	$effect(() => {
		previewWidth, resizePreview()
	})
	let active_dynamic_icon = $derived(getIcon(previewWidth))
	let active_static_icon = $derived(getIcon(active_static_width))
</script>

<div class="code-preview">
	{#if compilation_error}
		<pre transition:slide|local={{ duration: 100 }} class="error-container">
      {@html compilation_error}
    </pre>
	{/if}

	{#if consoleLog}
		<div class="logs" transition:slide|local>
			<div class="log">
				{#if typeof consoleLog === 'object'}
					<!-- <JSONTree value={consoleLog} /> -->
					<JsonView json={consoleLog} />
					<pre>{@html JSON}</pre>
				{:else}
					<pre>{@html consoleLog}</pre>
				{/if}
			</div>
		</div>
	{/if}
	<div in:fade class="preview-container" class:loading bind:this={container} bind:clientWidth={previewWidth}>
		{#if componentApp}
			<iframe
				tabindex="-1"
				style:transform={view === 'large' ? scale : ''}
				style:height={view === 'large' ? height : '100%'}
				style:width={view === 'large' ? `${active_static_width}px` : '100%'}
				onload={setLoading}
				title="Preview HTML"
				srcdoc={dynamic_iframe_srcdoc(component_head_html)}
				bind:this={iframe}
			></iframe>
		{:else}
			<iframe
				tabindex="-1"
				style:transform={view === 'large' ? scale : ''}
				style:height={view === 'large' ? height : '100%'}
				style:width={view === 'large' ? `${active_static_width}px` : '100%'}
				onload={() => (iframeLoaded = true)}
				title="Preview"
				srcdoc={preview}
				bind:this={iframe}
			></iframe>
		{/if}
	</div>
	{#if !hideControls}
		<div class="footer-buttons">
			<div class="preview-width">
				{#if view === 'large'}
					<button onclick={cycle_preview}>
						<Icon icon={active_static_icon} height="1rem" />
					</button>
					<button>
						<div
							class="static-width"
							use:content_editable={{
								on_change: (e) => {
									active_static_width = Number(e.target.textContent)
									resizePreview()
								}
							}}
						>
							{active_static_width}
						</div>
					</button>
				{:else}
					<span>
						<Icon icon={active_dynamic_icon} height="1rem" />
					</span>
					<span>
						{previewWidth}
					</span>
				{/if}
			</div>
			<button class="switch-view" onclick={changeView}>
				<Icon icon={view === 'small' ? 'fa-solid:compress-arrows-alt' : 'fa-solid:expand-arrows-alt'} />
				{#if view === 'large'}
					<span>static width</span>
				{:else}
					<span>dynamic width</span>
				{/if}
			</button>
			<button onclick={toggleOrientation} class="preview-orientation">
				{#if orientation === 'vertical'}
					<Icon icon="charm:layout-rows" />
				{:else if orientation === 'horizontal'}
					<Icon icon="charm:layout-columns" />
				{/if}
			</button>
			<button title="Toggle auto-refresh (refresh with Command R)" class="auto-refresh" class:toggled={$autoRefresh} onclick={() => ($autoRefresh = !$autoRefresh)}>
				<Icon icon="bx:refresh" />
			</button>
		</div>
	{/if}
</div>

<svelte:window onresize={resizePreview} />

<style lang="postcss">
	.code-preview {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;

		.error-container {
			color: var(--primo-color-white);
			background: var(--primo-color-danger);
			padding: 5px;
		}

		.logs {
			--json-tree-font-family: 'Fira Code', serif, monospace;
			--json-tree-label-color: #569cd6;

			display: grid;
			gap: 0.5rem;
			background: white;
			border: 2px solid var(--color-gray-8);
			padding: 0.75rem 1rem;
			overflow: auto;

			pre {
				display: block;
			}

			.log:not(:only-child):not(:last-child) {
				padding-bottom: 0.5rem;
				border-bottom: 1px solid rgba(250, 250, 250, 0.2);
			}
		}
	}
	iframe {
		border: 0;
		transition: opacity 0.4s;
		background: var(--primo-color-white);
		height: 100%;
		width: 100%;
		opacity: 1;
		transform-origin: top left;
	}
	.preview-container {
		background: var(--primo-color-white);
		border: 2px solid var(--color-gray-8);
		overflow: hidden;
		transition: border-color 0.2s;
		will-change: border-color;
		border-bottom: 0;
		flex: 1;
	}
	.preview-container.loading {
		border-color: var(--color-gray-7);
	}
	.footer-buttons {
		display: flex;
		flex-wrap: wrap;

		.preview-width {
			background: var(--primo-color-black);
			font-weight: 500;
			z-index: 10;
			display: flex;
			align-items: center;

			span {
				padding: 0.5rem;
				font-size: 0.75rem;
				border: 1px solid var(--color-gray-9);
				background: var(--color-gray-9);

				&:first-child {
					padding-right: 0;
				}

				&:last-child {
					padding-left: 0.25rem;
				}
			}

			.static-width {
				&:focus-visible {
					outline: none;
				}
				&::selection {
					background: var(--color-gray-7);
				}
			}
		}

		.switch-view {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}

		.preview-orientation {
			font-size: 1.25rem;
			padding: 0.25rem 0.5rem;
		}

		.auto-refresh {
			font-size: 1.5rem;
			padding: 0.25rem 0.5rem;
			opacity: 0.5;

			&.toggled {
				opacity: 1;
			}
		}
	}

	.footer-buttons {
		button {
			outline: 0;
			background: var(--color-gray-9);
			border: 1px solid var(--color-gray-8);
			font-size: var(--font-size-1);
			padding: 0.5rem;
			display: block;
			text-align: center;
			transition: var(--transition-colors);

			&:hover {
				background: var(--color-gray-8);
			}
		}
	}
</style>
