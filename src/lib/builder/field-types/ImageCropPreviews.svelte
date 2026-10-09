<script lang="ts">
	import { Smartphone, Tablet, Monitor } from 'lucide-svelte'
	import { image_crop_snapshot, measure_image_crop, type ImageCrop } from './image-crop'

	let { image, src, point }: { image?: HTMLImageElement | null; src: string; point: { x: number; y: number } } = $props()
	const sizes = [
		{ label: 'Phone', width: 390, height: 844, icon: Smartphone },
		{ label: 'Tablet', width: 768, height: 1024, icon: Tablet },
		{ label: 'Desktop', width: 1280, height: 900, icon: Monitor }
	]
	let snapshot = $state('')
	let crops = $state<(ImageCrop | null)[]>([null, null, null])
	let cleanups: (() => void)[] = []
	$effect(() => {
		snapshot = image?.isConnected ? image_crop_snapshot(image, src) : ''
		crops = [null, null, null]
		return () => {
			cleanups.forEach((cleanup) => cleanup())
			cleanups = []
		}
	})

	function observe_frame(frame: HTMLIFrameElement, index: number) {
		const target = frame.contentDocument?.querySelector<HTMLImageElement>('img[data-primo-crop-target]')
		if (!target) return
		const measure = () => (crops[index] = measure_image_crop(target))
		const observer = new ResizeObserver(measure)
		observer.observe(target)
		target.addEventListener('load', measure)
		frame.contentDocument?.fonts.ready.then(measure)
		measure()
		cleanups.push(() => {
			observer.disconnect()
			target.removeEventListener('load', measure)
		})
	}
	const position = $derived(`${point.x * 100}% ${point.y * 100}%`)
</script>

{#if snapshot}
	<div class="measurement-frames" aria-hidden="true">
		{#each sizes as size, index}
			<iframe
				sandbox="allow-same-origin"
				tabindex="-1"
				title={`${size.label} crop measurement`}
				srcdoc={snapshot}
				style:width="{size.width}px"
				style:height="{size.height}px"
				onload={({ currentTarget }) => observe_frame(currentTarget as HTMLIFrameElement, index)}
			></iframe>
		{/each}
	</div>
	<section class="crop-previews" aria-label="Responsive crop previews">
		{#each sizes as size, index}
			{@const crop = crops[index]}
			<figure>
				<div class="crop-stage">
					{#if crop}
						<img
							{src}
							alt={`${size.label} crop preview`}
							style:width="{Math.min(160, (110 * crop.width) / crop.height)}px"
							style:aspect-ratio="{crop.width} / {crop.height}"
							style:object-fit={crop.fit}
							style:object-position={position}
						/>
					{:else}<span class="unavailable">No visible crop</span>{/if}
				</div>
				<figcaption title={`${size.width}px viewport`}><size.icon size={13} />{size.label}</figcaption>
			</figure>
		{/each}
	</section>
{:else}
	<section class="crop-previews examples" aria-label="Example crops">
		{#each [{ label: 'Square', width: 110, height: 110 }, { label: 'Portrait', width: 83, height: 110 }] as crop}
			<figure>
				<div class="crop-stage"><img {src} alt={`${crop.label} crop preview`} style:width="{crop.width}px" style:height="{crop.height}px" style:object-position={position} /></div>
				<figcaption>{crop.label}</figcaption>
			</figure>
		{/each}
	</section>
{/if}
<p class="preview-note">
	{snapshot
		? 'Previews use the component’s CSS at 390, 768, and 1280px. Layout changes made by JavaScript are not included.'
		: 'Example crops. Open an image on the page to preview its responsive layout.'}
</p>

<style lang="postcss">
	.measurement-frames {
		position: fixed;
		left: -20000px;
		top: 0;
		visibility: hidden;
		pointer-events: none;
	}
	.measurement-frames iframe {
		display: block;
		border: 0;
	}
	.crop-previews {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.examples {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	figure {
		margin: 0;
		min-width: 0;
	}
	.crop-stage {
		height: 110px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-gray-9);
		border-radius: 4px;
	}
	img {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
		object-fit: cover;
	}
	figcaption {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		margin-top: 6px;
		font-size: 11px;
		color: var(--color-gray-4);
	}
	.unavailable,
	.preview-note {
		font-size: 11px;
		color: var(--color-gray-4);
	}
	.preview-note {
		margin: 0;
	}
</style>
