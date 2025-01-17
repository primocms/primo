<script>
	import { tick, onDestroy } from 'svelte'
	import { browser } from '$app/environment'
	import { find as _find } from 'lodash-es'
	import { supabase } from '$lib/supabase'

	/**
	 * @typedef {Object} Props
	 * @property {string} [site_id]
	 * @property {any} [preview]
	 * @property {string} [head]
	 * @property {string} [append]
	 * @property {string} [style]
	 */

	/** @type {Props} */
	let { site_id, preview = $bindable(null), head = '', append = '', style = '' } = $props()

	if (!preview && site_id) {
		get_preview()
	}

	async function get_preview() {
		const { data } = await supabase.storage.from('sites').download(`${site_id}/preview.html`)
		const html = await data?.text()
		preview = html
	}

	let container = $state()
	let scale = $state()
	let iframeHeight = $state()
	let iframe = $state()
	let iframeLoaded = $state()
	let resize_observer = $state()

	async function init_preview() {
		await tick()
		if (!iframe?.contentWindow?.document?.body) return

		resize_observer = new ResizeObserver((entries) => {
			const { offsetWidth: parentWidth } = container
			const { offsetWidth: childWidth } = iframe

			if (parentWidth === 0) return
			scale = parentWidth / childWidth
			iframeHeight = `${100 / scale}%`
		})

		resize_observer.observe(container)
	}

	function resize_preview() {
		const { clientWidth: parentWidth } = container
		const { clientWidth: childWidth } = iframe
		scale = parentWidth / childWidth
		iframeHeight = `${100 / scale}%`
	}

	function append_to_head(code) {
		var container = document.createElement('div')
		container.innerHTML = code
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.head.appendChild(node)
		})
	}

	$effect(() => {
		iframe && head && append_to_head(head)
	})

	function append_to_iframe(code) {
		var container = document.createElement('div')

		// Set the innerHTML of the container to your HTML string
		container.innerHTML = code

		// Append each element in the container to the document head
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.body.appendChild(node)
		})
	}

	$effect(() => {
		iframe && append && append_to_iframe(append)
	})

	onDestroy(() => {
		resize_observer?.disconnect()
	})
</script>

<svelte:window onresize={resize_preview} />

<div class="iframe-root bg-gray-900" {style}>
	<div bind:this={container} class="iframe-container z-10">
		{#if browser && preview}
			<iframe
				tabindex="-1"
				bind:this={iframe}
				class="rounded overflow-hidden bg-white"
				sandbox="allow-same-origin"
				style="transform: scale({scale}); width: 1024px;"
				style:height={iframeHeight}
				class:fadein={iframeLoaded}
				title="page preview"
				srcdoc={preview + append}
				onload={async () => {
					await init_preview()
					iframeLoaded = !!preview
				}}
			></iframe>
		{/if}
	</div>
</div>

<style lang="postcss">
	.iframe-root {
		overflow: hidden;
		position: relative;
		padding-top: var(--thumbnail-height, 130%);
	}
	.iframe-container {
		position: absolute;
		inset: 0;
		z-index: 10;
		opacity: 1;
		transition: opacity 0.1s;
		width: 100%;
		height: 100%;
		font-size: 0.75rem;
		line-height: 1rem;
		overflow: hidden;
		overflow-wrap: break-word;
		user-select: none;
	}
	iframe {
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.1s;
		width: 100vw;
		will-change: opacity;
		transform-origin: top left;
		/* height: 1000vh; */
	}
	.fadein {
		opacity: 1;
	}
</style>
