<script lang="ts">
	import { Crosshair } from 'lucide-svelte'
	import { get_focal_point } from '../utils'
	import { image_position_bounds, type ImageCrop } from './image-crop'
	let {
		src,
		point,
		custom,
		crop,
		large = false,
		editable = false,
		ref = $bindable<HTMLButtonElement>(),
		onchange,
		onopen
	}: {
		src: string
		point: { x: number; y: number }
		custom: boolean
		crop?: ImageCrop | null
		large?: boolean
		editable?: boolean
		ref?: HTMLButtonElement
		onchange: (point: { x: number; y: number }) => void
		onopen: () => void
	} = $props()
	let width = $state(0)
	let height = $state(0)
	let natural = $state({ width: 1, height: 1 })
	let dragging = $state(false)
	const can_position = $derived(custom || editable)
	const frame_style = $derived.by(() => {
		const size = crop || natural
		const scale = Math.min(width / size.width, height / size.height)
		return `width: ${size.width * scale}px; height: ${size.height * scale}px`
	})
	// A fractional object-position anchors the source point at the same fraction
	// of the crop box, so the handle stays under the pointer as the crop moves.
	function move(event: PointerEvent & { currentTarget: HTMLButtonElement }) {
		const rect = image_position_bounds(event.currentTarget.getBoundingClientRect(), natural, crop?.fit ?? 'contain', point)
		if (rect.width && rect.height) onchange(get_focal_point({ focal_point: { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height } }))
	}
	function keydown(event: KeyboardEvent) {
		if (!can_position) return
		const step = event.shiftKey ? 0.1 : 0.01
		const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
		if (!delta) return
		event.preventDefault()
		onchange(get_focal_point({ focal_point: { x: point.x + delta[0], y: point.y + delta[1] } }))
	}
</script>

<div class="stage" class:large bind:clientWidth={width} bind:clientHeight={height}>
	<button
		type="button"
		class:positioned={custom}
		class:editable
		bind:this={ref}
		style={frame_style}
		aria-label={can_position ? `Adjust position at ${Math.round(point.x * 100)}% ${Math.round(point.y * 100)}%. Click, drag, or use arrow keys.` : 'Position image'}
		title={can_position ? 'Click or drag to adjust position' : 'Position image'}
		onclick={() => {
			if (!can_position) onopen()
		}}
		onpointerdown={(event) => {
			if (!can_position || event.button !== 0 || !event.isPrimary) return
			dragging = true
			event.currentTarget.setPointerCapture(event.pointerId)
			move(event)
		}}
		onpointermove={(event) => {
			if (dragging) move(event)
		}}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
		onlostpointercapture={() => (dragging = false)}
		onkeydown={keydown}
	>
		<img
			{src}
			alt=""
			draggable="false"
			style:object-fit={crop?.fit ?? 'contain'}
			style:object-position="{point.x * 100}% {point.y * 100}%"
			onload={({ currentTarget }) => (natural = { width: (currentTarget as HTMLImageElement).naturalWidth, height: (currentTarget as HTMLImageElement).naturalHeight })}
		/>
		{#if custom}<span class="position-marker" aria-hidden="true" style:left="{point.x * 100}%" style:top="{point.y * 100}%"><Crosshair size={12} /></span>{/if}
	</button>
</div>

<style lang="postcss">
	.stage {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		background: var(--color-gray-9);
	}
	.stage.large {
		height: clamp(160px, 36vh, 260px);
	}
	button {
		position: relative;
		display: block;
		border: 0;
		padding: 0;
		background: transparent;
		cursor: pointer;
		border-radius: 4px;
	}
	button.positioned,
	button.editable {
		cursor: crosshair;
		touch-action: none;
	}
	button:focus-visible {
		outline: 2px solid var(--primo-primary-color);
		outline-offset: 2px;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		user-select: none;
		border-radius: 4px;
	}
	.position-marker {
		position: absolute;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(15, 15, 15, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.35);
		color: white;
		pointer-events: none;
		transform: translate(-50%, -50%);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
	}
	button:hover .position-marker,
	button:focus-visible .position-marker {
		background: rgba(15, 15, 15, 0.85);
	}
</style>
