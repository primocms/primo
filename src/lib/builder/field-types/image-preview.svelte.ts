import { SvelteMap } from 'svelte/reactivity'

// Entries identify rendered instances, including images inside repeaters. The
// hover dialog supplies its selected instance; the form uses a visible instance.
const rendered_images = new SvelteMap<HTMLImageElement, string>()
export function register_image_preview(image: HTMLImageElement, entry_id: string) {
	rendered_images.set(image, entry_id)
	return () => rendered_images.delete(image)
}
export function find_image_preview(entry_id?: string): HTMLImageElement | undefined {
	if (!entry_id) return
	for (const [image, id] of rendered_images) {
		if (id === entry_id && image.isConnected && image.getBoundingClientRect().width > 0) return image
	}
}
