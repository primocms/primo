<script lang="ts">
	import { get_focal_point } from '../utils'

	let {
		src,
		point,
		expanded = false,
		onchange
	}: {
		src: string
		point: { x: number; y: number }
		expanded?: boolean
		onchange: (point?: { x: number; y: number }) => void
	} = $props()

	let width = $state(0)
	let height = $state(0)
	let natural_size = $state<{ width: number; height: number } | null>(null)
	let dragging = $state(false)
	const frame_style = $derived.by(() => {
		if (!natural_size?.width || !natural_size?.height || !width || !height) return 'inset: 0'
		const scale = Math.min(width / natural_size.width, height / natural_size.height)
		const w = natural_size.width * scale
		const h = natural_size.height * scale
		return `left: ${(width - w) / 2}px; top: ${(height - h) / 2}px; width: ${w}px; height: ${h}px`
	})
	const position = $derived(`${point.x * 100}% ${point.y * 100}%`)

	function move(event: PointerEvent & { currentTarget: HTMLButtonElement }) {
		const rect = event.currentTarget.getBoundingClientRect()
		if (!rect.width || !rect.height) return
		onchange(get_focal_point({ focal_point: { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height } }))
	}

	function keydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 0.1 : 0.01
		const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
		if (!delta) return
		event.preventDefault()
		onchange(get_focal_point({ focal_point: { x: point.x + delta[0], y: point.y + delta[1] } }))
	}
</script>

<div class="focus-picker" class:expanded>
	<div class="source" bind:clientWidth={width} bind:clientHeight={height}>
		<button
			type="button"
			class="focal-frame"
			style={frame_style}
			title="Click or drag to choose what stays visible when cropped."
			aria-label="Focus point at {Math.round(point.x * 100)}% {Math.round(point.y * 100)}%. Click, drag, or use arrow keys to move it."
			onpointerdown={(event) => {
				if (event.button !== 0 || !event.isPrimary) return
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
				onload={({ currentTarget }) => (natural_size = { width: (currentTarget as HTMLImageElement).naturalWidth, height: (currentTarget as HTMLImageElement).naturalHeight })}
			/>
			<span class="focal-marker" style:left="{point.x * 100}%" style:top="{point.y * 100}%"></span>
		</button>
	</div>
	{#if expanded}
		<div class="crop-examples" aria-label="Example crops">
			<figure>
				<img {src} alt="Square crop preview" style:object-position={position} />
				<figcaption>Square</figcaption>
			</figure>
			<figure class="portrait">
				<img {src} alt="Portrait crop preview" style:object-position={position} />
				<figcaption>Portrait</figcaption>
			</figure>
		</div>
		<div class="focus-tools">
			<p title="Arrow keys move 1%; hold Shift to move 10%.">
				Click or drag to choose what stays visible when cropped.
				<span class="sr-only">Arrow keys move 1%; hold Shift to move 10%.</span>
			</p>
			<button type="button" disabled={point.x === 0.5 && point.y === 0.5} onclick={() => onchange()}>Reset to center</button>
		</div>
	{/if}
</div>

<style lang="postcss">
	.focus-picker {
		width: 100%;
		height: 100%;
	}
	.source {
		position: relative;
		width: 100%;
		height: 100%;
		background: var(--color-gray-9);
		border-radius: 4px;
	}
	.focal-frame {
		position: absolute;
		padding: 0;
		border: 0;
		background: none;
		cursor: crosshair;
		touch-action: none;
		&:focus-visible {
			outline: 2px solid var(--primo-primary-color);
			outline-offset: 2px;
		}
		img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: contain;
			user-select: none;
		}
	}
	.focal-marker {
		position: absolute;
		width: 16px;
		height: 16px;
		border: 2px solid var(--primo-primary-color, #5146e5);
		border-radius: 50%;
		background: transparent;
		box-shadow:
			inset 0 0 0 1px white,
			0 0 0 1px white,
			0 0 0 2px rgba(0, 0, 0, 0.65),
			0 1px 4px rgba(0, 0, 0, 0.5);
		transform: translate(-50%, -50%);
		pointer-events: none;
		&::after {
			content: '';
			position: absolute;
			left: 50%;
			top: 50%;
			width: 4px;
			height: 4px;
			border-radius: 50%;
			background: var(--primo-primary-color, #5146e5);
			box-shadow: 0 0 0 1px white, 0 0 0 2px rgba(0, 0, 0, 0.65);
			transform: translate(-50%, -50%);
		}
	}
	.expanded {
		height: auto;
		display: grid;
		gap: 12px;
		.source {
			height: clamp(160px, 36vh, 360px);
		}
		.focal-marker {
			width: 26px;
			height: 26px;
		}
	}
	.crop-examples {
		display: flex;
		align-items: center;
		gap: 16px;
		figure {
			margin: 0;
			flex-shrink: 0;
		}
		img {
			width: 72px;
			height: 72px;
			object-fit: cover;
			border-radius: 4px;
		}
		.portrait img {
			width: 54px;
		}
		figcaption {
			text-align: center;
			font-size: 11px;
			margin-top: 4px;
			color: var(--color-gray-4);
		}
	}
	p {
		margin: 0;
		font-size: 12px;
		color: var(--color-gray-4);
	}
	.focus-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.focus-tools button {
		padding: 5px 8px;
		border: 1px solid var(--color-gray-7);
		border-radius: 4px;
		font-size: 12px;
		color: var(--color-gray-2);
		cursor: pointer;
		&:hover {
			background: var(--color-gray-8);
		}
		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
		&:focus-visible {
			outline: 2px solid var(--primo-primary-color);
			outline-offset: 2px;
		}
	}
	@media (pointer: coarse) {
		.focus-tools button {
			min-height: 44px;
		}
	}
</style>
