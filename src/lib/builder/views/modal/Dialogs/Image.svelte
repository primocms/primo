<script>
	import _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import Button from '$lib/builder/ui/Button.svelte'
	import UI from '../../../ui'
	import { storageChanged } from '../../../database'

	let { value = {}, children, onsubmit } = $props()

	let imagePreview = $state(value?.url || '')
	let local_value = $state({
		alt: '',
		url: '',
		size: null,
		...value
	})
	let loading = $state(false)

	function setValue({ url, size }) {
		local_value = {
			...local_value,
			url: url,
			src: url,
			size
		}
	}

	async function encodeImageFileAsURL({ target }) {
		loading = true
		const { files } = target
		if (files.length > 0) {
			const image = files[0]

			// const compressed = await imageCompression(image, {
			// 	maxSizeMB: 0.5
			// })

			const key = `_images/${image.lastModified + image.name}`
			const { url } = await storageChanged({
				action: 'upload',
				key,
				file: image
			})

			if (url) {
				imagePreview = url

				setValue({
					url,
					size: Math.floor(image.size / 1024)
				})

				loading = false
			} else {
				loading = false
			}
		}
	}
</script>

<div>
	<div class="image-info">
		{#if loading}
			<UI.Spinner />
		{:else}
			<div class="image-preview">
				{#if local_value.size}
					<span class="field-size">
						{local_value.size}KB
					</span>
				{/if}
				{#if imagePreview}
					<img src={imagePreview} alt="Preview" />
				{/if}
				<label class="image-upload">
					<Icon height="2rem" icon="uil:image-upload" />
					{#if !local_value.url}
						<span>Upload</span>
					{/if}
					<input onchange={encodeImageFileAsURL} type="file" accept="image/*" />
				</label>
			</div>
		{/if}
		<form
			onsubmit={(event) => {
				event.preventDefault()
				onsubmit(local_value)
			}}
		>
			<div class="inputs">
				<label class="image-input">
					<span>URL</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						autofocus
						oninput={({ target }) => {
							imagePreview = target.value
							local_value = {
								alt: '',
								url: target.value,
								size: null
							}
						}}
						value={local_value.url}
						type="url"
					/>
				</label>
				<label class="image-input">
					<span>Description</span>
					<input type="text" value={local_value.alt} />
				</label>
			</div>
			<footer>
				<Button type="submit" label="Add Image" />
			</footer>
		</form>
	</div>
</div>
{@render children?.()}

<style lang="postcss">
	.image-info {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #1a1a1a;
		padding: 0.25rem 0.75rem 0.75rem 0.75rem;
		--Spinner-padding: 3rem;
	}
	input {
		background: var(--color-gray-8);
	}
	.image-preview {
		width: 100%;
		padding-top: 50%;
		position: relative;
		margin-bottom: 0.25rem;

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

		img {
			position: absolute;
			inset: 0;
			object-fit: cover;
			height: 100%;
			width: 100%;
		}
	}

	.inputs {
		display: flex;
		flex-direction: column;
		width: 100%;

		.image-input {
			display: flex;
			align-items: center;
			font-size: var(--font-size-1);
			width: 100%;
			margin-bottom: 0.25rem;

			span {
				font-weight: 600;
				padding: 0 0.5rem;
			}

			input {
				font-size: inherit;
				flex: 1;
				padding: 0 0.25rem;
				outline: 0;
				border: 0;
			}
		}
	}

	footer {
		margin-top: 0.5rem;
	}
</style>
