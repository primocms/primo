// Browser-session navigation memory. Only written from client effects/actions.
export const marketplaceNavigation = $state<Record<string, string>>({ starters: '', blocks: '' })
const scrollPositions = new Map<string, number>()

/** Restore category scroll after async previews acquire their final height. */
export function rememberMarketplaceScroll(node: HTMLElement, key: string) {
	let cleanup = setup(key)
	function setup(key: string) {
		const saved = scrollPositions.get(key) ?? 0
		let restoring = saved > 0
		const restore = () => {
			if (!restoring) return
			node.scrollTop = saved
			if (node.scrollHeight - node.clientHeight >= saved) restoring = false
		}
		const resize = new ResizeObserver(restore)
		const observeChildren = () => {
			resize.disconnect()
			for (const child of node.children) resize.observe(child)
			restore()
		}
		const mutation = new MutationObserver(observeChildren)
		mutation.observe(node, { childList: true })
		const onScroll = () => {
			if (!restoring) scrollPositions.set(key, node.scrollTop)
		}
		const onInteraction = () => {
			restoring = false
		}
		node.scrollTop = 0
		node.addEventListener('scroll', onScroll)
		node.addEventListener('wheel', onInteraction, { passive: true })
		node.addEventListener('pointerdown', onInteraction)
		node.addEventListener('keydown', onInteraction)
		observeChildren()
		return () => {
			resize.disconnect()
			mutation.disconnect()
			node.removeEventListener('scroll', onScroll)
			node.removeEventListener('wheel', onInteraction)
			node.removeEventListener('pointerdown', onInteraction)
			node.removeEventListener('keydown', onInteraction)
		}
	}
	return {
		update(nextKey: string) {
			cleanup()
			cleanup = setup(nextKey)
		},
		destroy() {
			cleanup()
		}
	}
}
