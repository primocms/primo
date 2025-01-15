<script>
	import Icon from '@iconify/svelte'
	import { tick } from 'svelte'
	import { static_iframe_srcdoc } from './misc'
	import _ from 'lodash-es'

	/**
	 * @typedef {Object} Props
	 * @property {any} componentCode
	 * @property {any} height
	 * @property {string} [append]
	 */

	/** @type {Props} */
	let { componentCode, height = $bindable(), append = '' } = $props()

	let container = $state()
	let iframe = $state()
	let iframeLoaded = $state()
	let finishedResizing = $state(false)
	async function setIframeContent() {
		setScaleRatio()
		await tick()
		setHeight()
	}

	function setHeight() {
		// iframe.height = '';
		const newHeight = iframe.contentWindow.document.body.scrollHeight * scaleRatio
		// iframe.height = newHeight;
		// iframe.width = newHeight;
		height = newHeight
		container_height = iframe.contentWindow.document.body.scrollHeight
		finishedResizing = true
	}

	function setScaleRatio() {
		if (!container || !iframe) return
		const { clientWidth: parentWidth } = container
		const { clientWidth: childWidth } = iframe
		scaleRatio = parentWidth / childWidth
	}

	let scaleRatio = $state(1)
	let container_height = $state()

	let load_observer = $state()
	let resize_observer = $state()

	function append_to_iframe(code) {
		var container = document.createElement('div')

		// Set the innerHTML of the container to your HTML string
		container.innerHTML = code

		// Append each element in the container to the document head
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.body.appendChild(node)
		})
	}

	let setup_complete = $state(false)
	let srcdoc = $state('')
	let active_code = {}
	async function set_srcdoc(componentCode) {
		active_code = _.cloneDeep(componentCode)
		srcdoc = static_iframe_srcdoc({
			head: componentCode.head,
			html: componentCode.html,
			css: componentCode.css,
			foot: append
		})
		setup_complete = true
	}
	$effect(() => {
		iframeLoaded && setIframeContent()
	})
	$effect(() => {
		if (container && iframe) {
			if (load_observer) load_observer.disconnect()
			if (resize_observer) resize_observer.disconnect()
			const sidebar = container.closest('.sidebar')
			if (sidebar) {
				resize_observer = new ResizeObserver(setScaleRatio).observe(sidebar)
				load_observer = new ResizeObserver(() => {
					// workaround for on:load not working reliably
					if (iframe?.contentWindow.document.body?.childNodes) {
						setScaleRatio()
						setHeight()
					}
				}).observe(iframe)
			}
		}
	})
	$effect(() => {
		iframe && append_to_iframe(append)
	})
	$effect(() => {
		!setup_complete && set_srcdoc(componentCode)
	})
</script>

<svelte:window onresize={setScaleRatio} />

<div class="IFrame">
	{#if !iframeLoaded}
		<div class="spinner-container">
			<Icon icon="eos-icons:three-dots-loading" />
		</div>
	{/if}
	<div bind:this={container} class="iframe-container" style:height="{container_height * scaleRatio}px">
		{#if componentCode}
			<iframe
				class:fadein={finishedResizing}
				style:transform="scale({scaleRatio})"
				style:height={100 / scaleRatio + '%'}
				scrolling="no"
				title="Preview HTML"
				onload={() => (iframeLoaded = true)}
				{srcdoc}
				bind:this={iframe}
			></iframe>
		{/if}
	</div>
</div>

<style lang="postcss">
	.IFrame {
		position: relative;
		inset: 0;
		min-height: 2rem;
		/* height: 100%; */
	}

	.spinner-container {
		--Spinner-size: 1rem;
		width: 100%;
		height: 100%;
		position: absolute;
		left: 0;
		top: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 50;
	}
	.iframe-container {
		/* background: var(--primo-color-white); */
		/* position: absolute; */
		inset: 0;
		/* height: 100%; */

		iframe {
			opacity: 0;
			transition: opacity 0.2s;
			position: absolute;
			top: 0;
			left: 0;
			pointer-events: none;
			width: 100vw;
			transform-origin: top left;
			height: 100%;

			&.fadein {
				opacity: 1;
				background: white;
			}
		}
	}
</style>
