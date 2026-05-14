<script lang="ts">
	import * as _ from 'lodash-es'
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

	const {
		field,
		entry: passedEntry,
		onchange
	}: {
		field: Field
		entry?: Entry
		onchange: FieldValueHandler
	} = $props()

	type ImageFieldValue = {
		alt: string
		url: string
		upload?: string | null
		width?: number | null
		height?: number | null
	}

	const default_value: ImageFieldValue = {
		alt: '',
		url: '',
		upload: null,
		width: null,
		height: null
	}

	const entry = $derived(passedEntry || { value: default_value }) as Omit<Entry, 'value'> & { value: ImageFieldValue }
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
							height: dimensions?.height ?? null
						}
					}
				}
			})
		} finally {
			loading = false
		}
	}

	let image_size = $state(null)
	let loading = $state(false)

	let width = $state<number | undefined>()
	let collapsed = $derived(!width || width < 200)
	let upload = $derived(entry.value.upload ? ('site' in field && site ? SiteUploads.one(entry.value.upload) : LibraryUploads.one(entry.value.upload)) : null)
	let upload_url = $derived(
		upload && (typeof upload.file === 'string' ? `${self.instance?.baseURL}/api/files/${site ? 'site_uploads' : 'library_uploads'}/${upload.id}/${upload.file}` : URL.createObjectURL(upload.file))
	)
	let input_url = $derived(entry.value.url)
	let url = $derived(input_url || upload_url)

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

<div class="ImageField" bind:clientWidth={width} class:collapsed>
	<span class="primo--field-label">{field.label}</span>
	<div class="image-info">
		<div class="image-preview">
			{#if loading}
				<div class="spinner-container">
					<Spinner />
				</div>
			{:else}
				{#if image_size}
					<span class="field-size">
						{image_size}KB
					</span>
				{/if}
				{#if entry.value.width && entry.value.height}
					<span class="field-dimensions">
						{entry.value.width} × {entry.value.height}
					</span>
				{/if}
				{#if url}
					<img src={url} alt="Preview" />
				{/if}
				<label class="image-upload">
					<Icon icon="uil:image-upload" />
					{#if !entry.value.url}
						<span>Upload</span>
					{/if}
					<input
						onchange={({ target }) => {
							const { files } = target as HTMLInputElement
							if (files?.length) {
								const image = files[0]
								upload_image(image)
							}
						}}
						type="file"
						accept="image/*"
					/>
				</label>
			{/if}
		</div>
		<div class="inputs">
			<TextInput value={entry.value.alt} label="Description" oninput={(alt) => onchange({ [field.key]: { 0: { value: { ...entry.value, alt } } } })} />
			<TextInput
				value={entry.value.url}
				label="URL"
				oninput={(value) => {
					onchange({ [field.key]: { 0: { value: { ...entry.value, url: value, upload: undefined } } } })
				}}
				onchange={(value) => {
					onchange({ [field.key]: { 0: { value: { ...entry.value, url: value, upload: undefined } } } })
				}}
			/>
		</div>
	</div>
</div>

<style lang="postcss">
	* {
		--TextInput-label-font-size: 0.75rem;
	}
	.ImageField {
		display: grid;

		&.collapsed .image-info {
			display: grid;
			gap: 0;
		}

		&.collapsed .inputs {
			padding: 0.5rem;
			background: var(--color-gray-9);
		}
	}
	.image-info {
		display: flex;
		gap: 0.75rem;
		overflow: hidden;
		align-items: flex-start;
		/* border: 1px solid var(--primo-primary-color); */
		/* padding: 0.5rem; */

		.spinner-container {
			background: var(--primo-primary-color);
			height: 100%;
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
	input {
		background: var(--color-gray-8);
	}
	.image-preview {
		border: 1px dashed #3e4041;
		border-radius: 4px;
		aspect-ratio: 1;
		height: 100%;
		/* width: 13rem; */
		position: relative;

		.image-upload {
			flex: 1 1 0%;
			padding: 1rem;
			cursor: pointer;
			position: relative;
			width: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			color: var(--color-gray-2);
			background: var(--color-gray-9);
			font-weight: 600;
			text-align: center;
			position: absolute;
			inset: 0;
			opacity: 0.5;
			transition: opacity, background;
			transition-duration: 0.1s;

			&:hover {
				opacity: 0.95;
				background: var(--primo-primary-color);
			}

			span {
				margin-top: 0.25rem;
			}

			input {
				visibility: hidden;
				border: 0;
				width: 0;
				position: absolute;
			}
		}

		.field-size {
			background: var(--color-gray-8);
			color: var(--color-gray-3);
			position: absolute;
			top: 0;
			left: 0;
			z-index: 1;
			padding: 0.25rem 0.5rem;
			font-size: var(--font-size-1);
			font-weight: 600;
			border-bottom-right-radius: 0.25rem;
		}

		.field-dimensions {
			background: var(--color-gray-8);
			color: var(--color-gray-3);
			position: absolute;
			bottom: 0;
			right: 0;
			z-index: 1;
			padding: 2px 4px;
			font-size: 0.5rem;
			border-top-left-radius: 0.25rem;
		}

		img {
			position: absolute;
			inset: 0;
			object-fit: cover;
			height: 100%;
			width: 100%;
		}
	}

	.inputs {
		display: grid;
		row-gap: 6px;
		width: 100%;
		--TextInput-font-size: 0.75rem;
	}

	/* .image-type-buttons {
		margin-top: 3px;
		font-size: 0.75rem;
		display: flex;
		border-radius: var(--primo-border-radius);
		border: 1px solid var(--color-gray-8);
		justify-self: flex-start;

		button {
			padding: 2px 6px;

			&.active {
				cursor: unset;
				color: var(--primo-primary-color);
			}

			&:last-child {
				border-left: 1px solid var(--color-gray-8);
			}
		}
	} */
</style>
