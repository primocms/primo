<script lang="ts">
	import type { Site } from '$lib/common/models/Site'
	import { Globe } from 'lucide-svelte'
	import { onDestroy, tick } from 'svelte'
	import { createResizeTask } from '$lib/resize_task.js'

	let { site, style, src, preview_document, snapshot = false, placeholder }: {
		site?: Site; style?: string; src?: string; preview_document?: string; snapshot?: boolean; placeholder?: string
	} = $props()

	// Dashboard thumbnails use the stored homepage preview, with scripts
	// blocked by the server so hydration can't change its markup or styles.
	// Keep the site ID in the URL so relative assets resolve to this site.
	// The preview filename changes after publishing and reloads the iframe.
	// Marketplace snapshots use an opaque-origin, script-free srcdoc instead.
	const preview_token = $derived(typeof site?.preview === 'string' ? site.preview : '')
	const iframe_src = $derived(src ?? `/?_site=${site?.id}&_preview=1${preview_token ? `&v=${encodeURIComponent(preview_token)}` : ''}`)

	let container = $state<HTMLElement>()
	let scale = $state(1)
	let iframeHeight = $state('100%')
	let iframe = $state<HTMLIFrameElement>()
	let iframeLoaded = $state()
	let resize_observer = $state<ResizeObserver>()
	const resize_task = createResizeTask(resize_preview)

	async function init_preview() {
		await tick()
		if (!container || !iframe) return
		// if (!iframe?.contentWindow?.document?.body) return
		if (resize_observer) resize_observer?.disconnect()

		resize_observer = new ResizeObserver(() => {
			resize_task.schedule()
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
		if (parentWidth === 0 || childWidth === 0) return
		scale = parentWidth / childWidth
		iframeHeight = `${100 / scale}%`
	}

	onDestroy(() => {
		resize_task.dispose()
		resize_observer?.disconnect()
	})
</script>

<svelte:window onresize={resize_task.schedule} />

<div class="iframe-root bg-gray-900" {style}>
	<div bind:this={container} class="iframe-container">
		{#if site && (snapshot ? preview_document !== undefined : src || site.preview)}
			<iframe
				tabindex="-1"
				bind:this={iframe}
				class="w-[1024px] rounded overflow-hidden bg-white"
				style:transform="scale({scale})"
				style:height={iframeHeight}
				class:fadein={iframeLoaded}
				title="site preview"
				src={snapshot ? undefined : iframe_src}
				srcdoc={snapshot ? preview_document : undefined}
				sandbox={snapshot ? '' : undefined}
				referrerpolicy={snapshot ? 'no-referrer' : undefined}
				onload={async () => {
					await init_preview()
				}}
			></iframe>
		{:else}
			<div class="h-full flex flex-col gap-3 justify-center items-center text-white">
				<Globe color="white" size="5rem" />
				{#if placeholder}<span role="status">{placeholder}</span>{/if}
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
