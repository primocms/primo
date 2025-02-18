<script>
	import UI from '../../../ui'
	import Button from '$lib/builder/ui/Button.svelte'

	const defaultValue = {
		url: ''
	}

	let { value = $bindable(defaultValue), children, onsubmit } = $props()

	if (typeof value === 'string' || !value) {
		value = defaultValue
	}

	let videoURL = $state(value.url || '')
	let video_id = $state()
	let loading = false

	$effect(() => {
		if (value.url) {
			try {
				const url = new URL(value.url)
				const params = new URLSearchParams(url.search)
				video_id = params.get('v')
			} catch (e) {}
		}
	})
</script>

<div>
	<div class="image-info">
		{#if loading}
			<UI.Spinner />
		{:else if value.url}
			<div class="image-preview">
				<iframe
					style="position: absolute;
				inset: 0;
				height: 100%;
				width: 100%;"
					src="https://www.youtube.com/embed/{video_id}"
					title="YouTube video player"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerpolicy="strict-origin-when-cross-origin"
					allowfullscreen
				></iframe>
			</div>
		{/if}
		<form
			onsubmit={(e) => {
				e.preventDefault()
				onsubmit(videoURL)
			}}
		>
			<div class="inputs">
				<UI.TextInput
					label="Youtube Video URL"
					bind:value={value.url}
					type="url"
					autofocus
					oninput={(text) => {
						videoURL = text
					}}
				/>
			</div>
			<footer>
				<Button type="submit" label="Add Video" />
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
		gap: 0.5rem;
	}
	.image-preview {
		width: 100%;
		padding-top: 50%;
		position: relative;
		margin-bottom: 0.25rem;
	}

	.inputs {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	footer {
		margin-top: 0.5rem;
	}
</style>
