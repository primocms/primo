<script>
	import { browser } from '$app/environment'
	import { find as _find } from 'lodash-es'

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Site} site
	 * @property {any} [preview]
	 * @property {string} [append]
	 * @property {string} [style]
	 * @property {any} [src]
	 */

	/** @type {Props} */
	let { site, preview = $bindable(null), append = '', style = '', src = null } = $props()

	if (!preview && site) {
		get_preview()
	}

	async function get_preview() {
		const response = await fetch(`https://cdn.primo.page/${site.custom_domain || site.id}/staging/index.html`)
		const html = await response.text()
		preview = html
	}

	let container = $state()
	let scale = $state()
	let iframeHeight = $state()
	let iframe = $state()
	let iframeLoaded = $state()

	function resizePreview() {
		const { clientWidth: parentWidth } = container
		const { clientWidth: childWidth } = iframe
		scale = parentWidth / childWidth
		iframeHeight = `${100 / scale}%`
	}

	function append_to_iframe(code) {
		var container = document.createElement('div')

		// Set the innerHTML of the container to your HTML string
		container.innerHTML = code

		// Append each element in the container to the document head
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.body.appendChild(node)
		})
	}

	// wait for processor to load before building preview
	let processorLoaded = false
	setTimeout(() => {
		processorLoaded = true
	}, 500)
	$effect(() => {
		iframe && append_to_iframe(append)
	})
</script>

<svelte:window onresize={resizePreview} />

<div class="iframe-root" {style}>
	<div bind:this={container} class="iframe-container">
		{#if browser}
			<iframe
				tabindex="-1"
				bind:this={iframe}
				sandbox=""
				style="transform: scale({scale})"
				style:height={iframeHeight}
				class:fadein={iframeLoaded}
				title="page preview"
				{src}
				srcdoc={preview + append}
				onload={() => {
					resizePreview()
					iframeLoaded = true
				}}
			></iframe>
		{/if}
	</div>
</div>

<style lang="postcss">
	.iframe-root {
		pointer-events: none;
		overflow: hidden;
		position: relative;
		padding-top: var(--thumbnail-height, 75%);
	}
	.iframe-container {
		position: absolute;
		inset: 0;
		z-index: 10;
		background: transparent;
		opacity: 1;
		transition: opacity 0.1s;
		width: 100%;
		height: 100%;
		font-size: 0.75rem;
		line-height: 1rem;
		overflow: hidden;
		overflow-wrap: break-word;
	}
	iframe {
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.1s;
		background: var(--color-white);
		width: 100vw;
		will-change: opacity;
		transform-origin: top left;
		/* height: 1000vh; */
	}
	.fadein {
		opacity: 1;
	}
</style>
