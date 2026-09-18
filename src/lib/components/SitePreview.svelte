<script lang="ts">
	import type { Site } from '$lib/common/models/Site'
	import { Globe } from 'lucide-svelte'
	import { onDestroy, tick } from 'svelte'

	let { site, style, src }: { site?: Site; style?: string; src?: string } = $props()

	// The default preview iframe serves the site's published files at
	// `/?_site=ID`. That URL never changes, so after a re-publish the already
	// loaded iframe keeps showing the old build. The publish worker writes the
	// fresh home HTML to `site.preview` (a file field whose stored filename gets
	// a new random suffix each publish), so fold it into the src as a
	// cache-buster: when a publish lands, the src changes and the iframe reloads.
	// Only applies to the default src — callers passing an explicit `src`
	// (marketplace, starters) are left untouched.
	const preview_token = $derived(typeof site?.preview === 'string' ? site.preview : '')
	const iframe_src = $derived(src ?? `/?_site=${site?.id}${preview_token ? `&v=${encodeURIComponent(preview_token)}` : ''}`)

	let container = $state()
	let scale = $state()
	let iframeHeight = $state()
	let iframe = $state()
	let iframeLoaded = $state()
	let resize_observer = $state()

	async function init_preview() {
		await tick()
		// if (!iframe?.contentWindow?.document?.body) return
		if (resize_observer) resize_observer?.disconnect()

		resize_observer = new ResizeObserver((entries) => {
			const { offsetWidth: parentWidth } = container
			const { offsetWidth: childWidth } = iframe

			if (parentWidth === 0) return
			scale = parentWidth / childWidth
			iframeHeight = `${100 / scale}%`
			// give it a sec to load in
			setTimeout(() => {
				iframeLoaded = true
			}, 200)
		})

		resize_observer.observe(container)
	}

	function resize_preview() {
		if (!container || !iframe) return
		const { clientWidth: parentWidth } = container
		const { clientWidth: childWidth } = iframe
		scale = parentWidth / childWidth
		iframeHeight = `${100 / scale}%`
	}

	onDestroy(() => {
		resize_observer?.disconnect()
	})
</script>

<svelte:window onresize={resize_preview} />

<div class="iframe-root bg-gray-900" {style}>
	<div bind:this={container} class="iframe-container">
		{#if site && (src || site.preview)}
			<iframe
				tabindex="-1"
				bind:this={iframe}
				class="w-[1024px] rounded overflow-hidden bg-white"
				style:transform="scale({scale})"
				style:height={iframeHeight}
				class:fadein={iframeLoaded}
				title="site preview"
				src={iframe_src}
				onload={async () => {
					await init_preview()
				}}
			></iframe>
		{:else}
			<div class="h-full flex justify-center items-center">
				<Globe color="white" size="5rem" />
			</div>
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
		transition: opacity 0.2s;
		width: 100vw;
		will-change: opacity;
		transform-origin: top left;
		/* height: 1000vh; */
	}
	.fadein {
		opacity: 1;
	}
</style>
