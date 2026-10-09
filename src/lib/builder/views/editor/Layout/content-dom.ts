type TextDOM = { node: Node; value: string | null; children: TextDOM[] }
const textDOM = new WeakMap<HTMLElement, TextDOM>()

export function rememberTextDOM(element: HTMLElement) {
	function capture(node: Node): TextDOM {
		return { node, value: node.nodeValue, children: Array.from(node.childNodes, capture) }
	}
	textDOM.set(element, capture(element))
}

export function restoreTextDOM(element: HTMLElement) {
	function restore(tree: TextDOM) {
		if (tree.node.nodeType === 3) tree.node.nodeValue = tree.value
		const children = tree.children.map((child) => child.node)
		if (children.length !== tree.node.childNodes.length || children.some((child, index) => child !== tree.node.childNodes[index])) {
			const parent = tree.node as ParentNode
			parent.replaceChildren(...children)
		}
		tree.children.forEach(restore)
	}
	const tree = textDOM.get(element)
	if (tree) restore(tree)
}

export function createRichTextSurface(element: HTMLElement) {
	const surface = element.ownerDocument.createElement('div')
	surface.setAttribute('data-primo-rich-text-editor', '')
	restoreRichTextSurface(element, surface)
	return surface
}

export function restoreRichTextSurface(element: HTMLElement, surface: HTMLElement) {
	if (surface.parentElement === element) return
	// Keep any Svelte HTML anchors alive off-document. Controlled HTML can
	// replace the container's children on updates; reattach the existing editor
	// in the same render task so its images and state survive that replacement.
	const source = element.ownerDocument.createDocumentFragment()
	source.append(...element.childNodes)
	element.append(surface)
	return source
}
