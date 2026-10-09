export type ImageCrop = { width: number; height: number; fit: 'cover' | 'contain' | 'fill' }

export function measure_image_crop(image?: HTMLImageElement | null): ImageCrop | null {
	if (!image?.isConnected) return null
	const style = image.ownerDocument.defaultView?.getComputedStyle(image)
	if (!style || !['cover', 'contain', 'fill'].includes(style.objectFit)) return null
	// Computed sizes avoid transforms used to scale the editor's page preview.
	const width = image.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')
	const height = image.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0')
	return width > 0 && height > 0 ? { width, height, fit: style.objectFit as ImageCrop['fit'] } : null
}

// Measure CSS layout at other widths without executing component scripts or
// mounting another editor. Preserve the exact selected image when URLs repeat.
export function image_crop_snapshot(image: HTMLImageElement, src?: string): string {
	const doc = image.ownerDocument
	const clone = doc.documentElement.cloneNode(true) as HTMLElement
	const index = [...doc.querySelectorAll('img')].indexOf(image)
	const target = clone.querySelectorAll('img')[index]
	target?.setAttribute('data-primo-crop-target', '')
	if (src && target && src !== image.src && src !== image.currentSrc) {
		target.src = src
		target.removeAttribute('srcset')
		target
			.closest('picture')
			?.querySelectorAll('source')
			.forEach((source) => source.remove())
	}
	clone.querySelectorAll('script, iframe, object, embed, meta[http-equiv="refresh"]').forEach((element) => element.remove())
	clone.querySelectorAll('*').forEach((element) => {
		for (const attribute of [...element.attributes]) {
			if (attribute.name.startsWith('on') || attribute.name === 'contenteditable' || attribute.name === 'autofocus') element.removeAttribute(attribute.name)
		}
	})
	const head = clone.querySelector('head')!
	clone.querySelectorAll('base').forEach((element) => element.remove())
	const base = doc.createElement('base')
	base.href = doc.baseURI
	head.prepend(base)
	return `<!doctype html>${clone.outerHTML}`
}

// Normalize against the visible image, excluding contain-mode letterboxing.
export function image_position_bounds(
	rect: { left: number; top: number; width: number; height: number },
	natural: { width: number; height: number },
	fit: ImageCrop['fit'],
	point: { x: number; y: number }
) {
	if (fit !== 'contain' || !natural.width || !natural.height) return rect
	const scale = Math.min(rect.width / natural.width, rect.height / natural.height)
	const width = natural.width * scale
	const height = natural.height * scale
	return { left: rect.left + (rect.width - width) * point.x, top: rect.top + (rect.height - height) * point.y, width, height }
}
