<script lang="ts">
	import Icon from '@iconify/svelte'

	let {
		visible = $bindable(false),
		image_element = $bindable<HTMLImageElement | null>(null),
		onClick = () => {},
		onDelete = () => {},
		onMouseDown = () => {},
		showDelete = true
	}: {
		visible?: boolean
		image_element?: HTMLElement | null
		onClick?: () => void
		onDelete?: () => void
		onMouseDown?: () => void
		showDelete?: boolean
	} = $props()

	let overlay_element = $state<HTMLElement>()

	export function focus() {
		overlay_element?.querySelector<HTMLButtonElement>('.edit-button')?.focus()
	}

	// Handle mouse move detection to hide overlay when mouse leaves image_element bounds
	function handleBodyMouseMove(event: MouseEvent) {
		if (!visible || !image_element) return
		const rect = image_element.getBoundingClientRect()
		const isOutside = event.x < rect.left || event.x > rect.right || event.y < rect.top || event.y > rect.bottom
		if (isOutside) {
			visible = false
		}
	}

	// Add/remove iframe/body mouse move listener when visible state changes
	$effect(() => {
		if (!image_element) return
		if (visible) {
			image_element.ownerDocument.body.addEventListener('mousemove', handleBodyMouseMove)
		} else {
			image_element.ownerDocument.body.removeEventListener('mousemove', handleBodyMouseMove)
		}

		// Cleanup on component destroy
		return () => {
			image_element.ownerDocument.body.removeEventListener('mousemove', handleBodyMouseMove)
		}
	})

	// Position the overlay over the target image_element
	function positionOverlay() {
		if (!overlay_element || !image_element) return

		const elementRect = image_element.getBoundingClientRect()
		const iframeElement = image_element.ownerDocument.defaultView!.frameElement

		if (iframeElement) {
			// If within an iframe element, adjust positioning relative to it
			const iframeRect = iframeElement.getBoundingClientRect()
			overlay_element.style.left = `${elementRect.left + iframeRect.left}px`
			overlay_element.style.top = `${elementRect.top + iframeRect.top}px`
		} else {
			// For RichText editor, position directly over the image_element
			// Small adjustment to account for any positioning quirks
			overlay_element.style.left = `${elementRect.left - 9}px` // adjust to dialog padding
			overlay_element.style.top = `${elementRect.top - 9}px` // adjust to dialog padding
		}

		overlay_element.style.width = `${elementRect.width}px`
		overlay_element.style.height = `${elementRect.height}px`
		overlay_element.style.borderRadius = getComputedStyle(image_element).borderRadius
	}

	// Update position when element changes
	$effect(() => {
		if (visible && image_element) {
			positionOverlay()
		}
	})

	// Handle events
	function handleClick() {
		visible = false
		onClick()
	}

	function handleDelete(event: MouseEvent) {
		visible = false
		event.stopPropagation() // Prevent triggering the main click handler
		onDelete()
	}

	function handleMouseDown() {
		onMouseDown()
	}
</script>

{#if visible && image_element}
	<div
		onwheel={() => {
			visible = false // prevent overlay from interrupting scroll, bad ux
		}}
		class="image-editor-overlay"
		bind:this={overlay_element}
		onmousedown={handleMouseDown}
		role="toolbar"
		tabindex="-1"
	>
		<button type="button" aria-label="Edit image" class="overlay-button edit-button" onclick={handleClick}>
			<Icon icon="uil:image-upload" style=" width: clamp(1rem, 50%, 1.5rem)" />
		</button>
		{#if showDelete}
			<button type="button" aria-label="Delete image" class="overlay-button delete-button" onclick={handleDelete}>
				<Icon icon="lucide:trash-2" style=" width: clamp(1rem, 50%, 1.5rem)" />
			</button>
		{/if}
	</div>
{/if}

<style lang="postcss">
	.image-editor-overlay {
		position: fixed;
		font-size: 14px;
		color: white;
		z-index: 9;
		transform-origin: top left;
		display: flex;
		overflow: visible;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.1s;
		overflow: hidden;

		&:hover,
		&:focus-within {
			opacity: 1;
		}
	}

	.overlay-button {
		border: none;
		color: white;
		padding: 0.5rem;
		border-radius: 2px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		transition: background-color 0.2s;
	}

	.edit-button {
		background: rgba(0, 0, 0, 0.6);

		flex: 1;

		&:hover {
			background: rgba(0, 0, 0, 0.8);
		}
	}

	.delete-button {
		background: rgba(220, 38, 38, 0.8);

		&:hover {
			background: rgba(220, 38, 38, 1);
		}
	}
</style>
