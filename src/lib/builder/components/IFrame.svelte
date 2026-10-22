<script>
	import { onDestroy } from 'svelte'
	import Icon from '@iconify/svelte'
	import { tick } from 'svelte'
	import { static_iframe_srcdoc } from './misc'
	import * as _ from 'lodash-es'
	import { watch, useResizeObserver } from 'runed'

	/**
	 * @typedef {Object} Props
	 * @property {any} [componentCode]
	 * @property {any} [height]
	 * @property {string | null} [srcdoc]
	 * @property {string | null} [head]
	 * @property {string} [append]
	 */

	/** @type {Props} */
	let { componentCode, height = $bindable(), srcdoc = '', head = '' } = $props()

	let container = $state()
	let iframe = $state()
	let iframe_loaded = $state(false)
	let finished_resizing = $state(false)

	function set_height() {
		if (!iframe?.contentWindow?.document?.body) return
		const body = iframe.contentWindow.document.body
		const newHeight = body.scrollHeight * scaleRatio
		height = newHeight
		container_height = body.scrollHeight
		finished_resizing = true
	}

	function set_scale_ratio() {
		if (!container || !iframe) return
		const { clientWidth: parentWidth } = container
		const { clientWidth: childWidth } = iframe
		scaleRatio = parentWidth / childWidth
	}

	let scaleRatio = $state(1)
	let container_height = $state()

	let load_observer = $state()
	let resize_observer = $state()
	let iframe_body = $state(null)

	function sync_iframe_size() {
		if (!container || !iframe) return
		if (!iframe?.contentDocument?.body) return
		set_scale_ratio()
		set_height()
	}

	// observe changes in component height to sync scaled height/ratio
	// mostly useful to updating in response to images loading in
	useResizeObserver(() => iframe_body, sync_iframe_size)

	// Set srcdoc from component code
	let generated_srcdoc = $state('')
	let active_code = {}
	let active_head = $state('')
	watch(
		() => componentCode,
		(code) => {
			if (_.isEqual(active_code, code) || !code) {
				return
			}
			generated_srcdoc = static_iframe_srcdoc({
				head: head + code.head,
				html: code.body,
				css: code.css
				// foot: append
			})
			active_code = _.cloneDeep(code)
		}
	)

	// Sync the iframe size (ratio & height) on initial load
	watch(
		() => iframe_loaded,
		(loaded) => {
			if (!loaded) return
			iframe_body = iframe?.contentDocument?.body ?? null
			if (!iframe_body) return
			tick().then(sync_iframe_size)
		}
	)

	// Append site HEAD code to iframe head
	watch(
		() => ({ iframe_loaded, head }),
		({ loaded, head }) => {
			if (!loaded || !head) return
			if (active_head === head) return
			var container = document.createElement('div')
			container.innerHTML = head
			Array.from(container.childNodes).forEach((node) => {
				iframe.contentWindow.document.head.appendChild(node)
			})
			active_head = head
		}
	)

	// listen to sidebar resizing to update scale ratio
	watch(
		() => ({ container, iframe }),
		({ container, iframe }) => {
			if (!container || !iframe) return
			if (load_observer) load_observer.disconnect()
			if (resize_observer) resize_observer.disconnect()
			const sidebar = container.closest('.sidebar')
			if (sidebar) {
				resize_observer = new ResizeObserver(set_scale_ratio)
				resize_observer.observe(sidebar)
				load_observer = new ResizeObserver(() => {
					// workaround for on:load not working reliably
					if (iframe?.contentWindow?.document?.body?.childNodes) {
						set_scale_ratio()
					}
				})
				load_observer.observe(iframe)
			}
		}
	)

	onDestroy(() => {
		if (load_observer) load_observer.disconnect()
		if (resize_observer) resize_observer.disconnect()
	})
</script>

<svelte:window onresize={set_scale_ratio} />

<div class="IFrame">
	{#if !iframe_loaded}
		<div class="spinner-container">
			<Icon icon="eos-icons:three-dots-loading" />
		</div>
	{/if}
	<div bind:this={container} class="iframe-container" style:height="{container_height * scaleRatio}px">
		{#if generated_srcdoc || srcdoc}
			<iframe
				class:fadein={finished_resizing}
				style:transform="scale({scaleRatio})"
				style:height={100 / scaleRatio + '%'}
				scrolling="no"
				title="Preview HTML"
				onload={() => {
					iframe_loaded = true
				}}
				srcdoc={generated_srcdoc || srcdoc}
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
