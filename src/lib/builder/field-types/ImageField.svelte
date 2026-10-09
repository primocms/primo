<script lang="ts">
	import Icon from '@iconify/svelte'
	import TextInput from '../ui/TextInput.svelte'
	import Spinner from '../ui/Spinner.svelte'
	import imageCompression from 'browser-image-compression'
	import type { Field } from '$lib/common/models/Field'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'
	import { LibraryUploads, SiteUploads } from '$lib/pocketbase/collections'
	import { site_context } from '../stores/context'
	import { self } from '$lib/pocketbase/managers'
	import { watch } from 'runed'
	import { get_focal_point } from '../utils'
	import ImageFocusPicker from './ImageFocusPicker.svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Button } from '$lib/components/ui/button'
	import { ImageUp, Expand } from 'lucide-svelte'
	import type { Snippet } from 'svelte'

	const {
		field,
		entry: passedEntry,
		onchange,
		show_focal_point = true,
		inline_focus = false,
		header_actions
	}: {
		field: Field
		entry?: Entry
		onchange: FieldValueHandler
		// Off where the value only feeds an <img> tag (e.g. rich-text images)
		show_focal_point?: boolean
		// The image dialog already has room for the full picker.
		inline_focus?: boolean
		header_actions?: Snippet
	} = $props()

	type ImageFieldValue = {
		alt: string
		url: string
		upload?: string | null
		width?: number | null
		height?: number | null
		// Fractions (0..1) of the original image; missing means centered
		focal_point?: { x: number; y: number }
	}

	const default_value: ImageFieldValue = {
		alt: '',
		url: '',
		upload: null,
		width: null,
		height: null
	}

	// Guard the value, not just the entry: legacy/empty image entries can have a null
	// or non-object `value`, which would make every `entry.value.X` access below throw.
	const entry = $derived.by(() => {
		const base = passedEntry || { value: default_value }
		const value = base.value && typeof base.value === 'object' ? { ...default_value, ...base.value } : default_value
		return { ...base, value }
	}) as Omit<Entry, 'value'> & { value: ImageFieldValue }
	const { value: site } = site_context.getOr({ value: null })

	// Helper function to extract image dimensions
	async function get_image_dimensions(source: File | string): Promise<{ width: number; height: number } | null> {
		return new Promise((resolve) => {
			const img = new Image()

			img.onload = () => {
				resolve({ width: img.naturalWidth, height: img.naturalHeight })
			}

			img.onerror = () => {
				resolve(null)
			}

			if (typeof source === 'string') {
				img.src = source
			} else {
				img.src = URL.createObjectURL(source)
			}
		})
	}

	async function upload_image(image: File) {
		try {
			loading = true

			// Check if the image is an SVG - if so, upload as-is without compression
			const is_svg = image.type === 'image/svg+xml' || image.name.toLowerCase().endsWith('.svg')

			let file_to_upload: File

			if (is_svg) {
				// SVGs are vector graphics and should not be compressed
				file_to_upload = image
			} else {
				// Get compression options from field config or use defaults
				const maxSizeMB = field.config?.maxSizeMB ?? 1
				const maxWidthOrHeight = field.config?.maxWidthOrHeight ?? 1920

				// Compression options
				const options = {
					maxSizeMB, // Maximum size in MB
					maxWidthOrHeight, // Resize large images to this dimension
					useWebWorker: true // Use web worker for better UI performance
				}

				// Compress the image
				// NOTE: browser-image-compression returns Blob instead of File
				const compressedImage: Blob = await imageCompression(image, options)
				file_to_upload = new File([compressedImage], image.name)
			}

			// Extract dimensions from the compressed/final image
			const dimensions = await get_image_dimensions(file_to_upload)

			// Reuse the existing upload record in place when the field already has
			// one, so re-cropping/replacing an image doesn't spawn an orphan record
			// on every edit. Site clones copy uploads (each clone gets its own
			// records), so this only shares within duplicated sections/repeater
			// items in the same site — an accepted trade for not accumulating
			// orphans that eventually bloat the publish snapshot.
			let upload_record
			if (upload && site) {
				upload_record = SiteUploads.update(upload.id, { file: file_to_upload })
			} else if (upload) {
				upload_record = LibraryUploads.update(upload.id, { file: file_to_upload })
			} else if (site) {
				upload_record = SiteUploads.create({ file: file_to_upload, site: site.id })
			} else {
				upload_record = LibraryUploads.create({ file: file_to_upload })
			}

			onchange({
				[field.key]: {
					0: {
						value: {
							...entry.value,
							upload: upload_record.id,
							url: '',
							width: dimensions?.width ?? null,
							height: dimensions?.height ?? null,
							focal_point: undefined
						}
					}
				}
			})
		} finally {
			loading = false
		}
	}

	let loading = $state(false)

	let width = $state<number | undefined>()
	let collapsed = $derived(!width || width < 200)
	// Uploads belong to the site when editing within a site context (symbol and page-type
	// fields have no `site` property, so checking the field would wrongly resolve site
	// uploads through LibraryUploads).
	let upload = $derived(entry.value.upload ? (site ? SiteUploads.one(entry.value.upload) : LibraryUploads.one(entry.value.upload)) : null)
	let upload_url = $derived(
		upload && (typeof upload.file === 'string' ? `${self.instance?.baseURL}/api/files/${site ? 'site_uploads' : 'library_uploads'}/${upload.id}/${upload.file}` : URL.createObjectURL(upload.file))
	)
	let input_url = $derived(entry.value.url)
	let url = $derived(input_url || upload_url)

	let focal_point = $derived(get_focal_point(entry.value))
	let can_set_focal_point = $derived(!!url && show_focal_point)
	let editing_focus = $state(false)
	let file_input = $state<HTMLInputElement>()
	let expand_button = $state<HTMLButtonElement>()

	function set_focal_point(point?: { x: number; y: number }) {
		onchange({ [field.key]: { 0: { value: { ...entry.value, focal_point: point } } } })
	}

	// Extract dimensions when URL changes (for external URLs)
	watch(
		() => input_url,
		(current_url) => {
			if (current_url && !entry.value.width && !entry.value.height) {
				get_image_dimensions(current_url).then((dimensions) => {
					if (dimensions) {
						onchange({
							[field.key]: {
								0: {
									value: {
										...entry.value,
										width: dimensions.width,
										height: dimensions.height
									}
								}
							}
						})
					}
				})
			}
		}
	)
</script>

<div class="ImageField" bind:clientWidth={width} class:collapsed class:inline-focus={inline_focus && can_set_focal_point}>
	<div class="field-header">
		<span class="primo--field-label">{field.label}</span>
		{#if url || header_actions}
			<div class="field-actions">
				{#if url}
					<button type="button" class="replace-button" disabled={loading} onclick={() => file_input?.click()}><ImageUp size={14} /> Replace</button>
					{#if can_set_focal_point && !inline_focus}
						<button type="button" class="expand-button" bind:this={expand_button} aria-label="Adjust focus" title="Adjust focus" disabled={loading} onclick={() => (editing_focus = true)}>
							<Expand size={14} />
						</button>
					{/if}
				{/if}
				{@render header_actions?.()}
			</div>
		{/if}
	</div>
	<input
		class="file-input"
		bind:this={file_input}
		type="file"
		accept="image/*"
		aria-label="Upload image"
		tabindex="-1"
		onchange={({ currentTarget }) => {
			const image = currentTarget.files?.[0]
			if (image) upload_image(image)
			currentTarget.value = ''
		}}
	/>
	<div class="image-info">
		<div class="image-preview" class:large={inline_focus && can_set_focal_point}>
			{#if loading}
				<div class="spinner-container"><Spinner /></div>
			{:else if can_set_focal_point}
				<ImageFocusPicker src={url!} point={focal_point} expanded={inline_focus} onchange={set_focal_point} />
			{:else if url}
				<button type="button" class="image-upload has-image" aria-label="Replace image" title="Replace image" onclick={() => file_input?.click()}><img src={url} alt="Preview" /></button>
			{:else}
				<button type="button" class="image-upload" onclick={() => file_input?.click()}>
					<Icon icon="uil:image-upload" />
					<span>Upload image</span>
				</button>
			{/if}
			{#if !inline_focus && entry.value.width && entry.value.height}
				<span class="field-dimensions">{entry.value.width} × {entry.value.height}</span>
			{/if}
		</div>
		<div class="inputs">
			<TextInput value={entry.value.alt} label="Description" oninput={(alt) => onchange({ [field.key]: { 0: { value: { ...entry.value, alt } } } })} />
			<TextInput
				value={entry.value.url}
				label="URL"
				oninput={(value) => {
					onchange({ [field.key]: { 0: { value: { ...entry.value, url: value, upload: undefined, focal_point: undefined } } } })
				}}
			/>
		</div>
	</div>
</div>

<Dialog.Root bind:open={editing_focus}>
	<Dialog.Content
		class="sm:max-w-[640px] max-h-[calc(100dvh-1rem)] overflow-y-auto pt-12"
		onCloseAutoFocus={(event) => {
			event.preventDefault()
			expand_button?.focus()
		}}
	>
		<Dialog.Title>Adjust focus</Dialog.Title>
		<Dialog.Description>Choose the part of the image to keep visible when it is cropped.</Dialog.Description>
		{#if can_set_focal_point}
			<ImageFocusPicker src={url!} point={focal_point} expanded onchange={set_focal_point} />
		{/if}
		<div class="flex justify-end"><Button onclick={() => (editing_focus = false)}>Done</Button></div>
	</Dialog.Content>
</Dialog.Root>

<style lang="postcss">
	* {
		--TextInput-label-font-size: 0.75rem;
	}
	.ImageField {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.field-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.field-header .primo--field-label {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.field-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.field-actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 28px;
		padding: 4px 8px;
		border: 1px solid var(--color-gray-7);
		border-radius: 4px;
		background: var(--color-gray-9);
		color: var(--color-gray-2);
		font-size: 12px;
		cursor: pointer;
		&:hover {
			background: var(--color-gray-8);
		}
		&:focus-visible {
			outline: 2px solid var(--primo-primary-color);
			outline-offset: 2px;
		}
		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
		&.expand-button {
			width: 28px;
			padding: 6px;
		}
	}
	.file-input {
		display: none;
	}
	.image-info {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		min-width: 0;
	}
	.image-preview {
		border: 1px solid var(--color-gray-7);
		border-radius: 4px;
		aspect-ratio: 1;
		width: 96px;
		flex-shrink: 0;
		position: relative;
		&.large {
			width: 100%;
			aspect-ratio: auto;
			border: 0;
		}
	}
	.spinner-container {
		background: var(--color-gray-9);
		min-height: 96px;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.image-upload {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px;
		cursor: pointer;
		background: var(--color-gray-9);
		color: var(--color-gray-2);
		font-size: 12px;
		border-radius: 4px;
		&:hover {
			background: var(--color-gray-8);
		}
		&:focus-visible {
			outline: 2px solid var(--primo-primary-color);
			outline-offset: 2px;
		}
		&.has-image {
			padding: 0;
		}
		img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}
	.field-dimensions {
		position: absolute;
		bottom: 0;
		right: 0;
		padding: 2px 4px;
		border-top-left-radius: 4px;
		background: var(--color-gray-8);
		color: var(--color-gray-3);
		font-size: 8px;
		pointer-events: none;
	}
	.inputs {
		display: grid;
		gap: 6px;
		width: 100%;
		min-width: 0;
		--TextInput-font-size: 0.75rem;
	}
	.collapsed,
	.inline-focus {
		.image-info {
			display: grid;
		}
		.image-preview {
			width: 100%;
		}
	}
	@media (pointer: coarse) {
		.field-actions button {
			min-height: 44px;
		}
		.field-actions button.expand-button {
			width: 44px;
		}
	}
</style>
