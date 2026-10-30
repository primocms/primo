import type { Page } from '$lib/common/models/Page'

// Calculate from positions in the visible list. Existing indices can have
// gaps after imports or deletions, so index arithmetic is not reliable.
export function reorderedPages(pages: Page[], source: Page, target: Page, edge: 'top' | 'bottom', firstIndex: number) {
	if (source.id === target.id || source.parent !== target.parent || !source.parent) return []
	const siblings = pages.filter((page) => page.parent === target.parent).sort((a, b) => a.index - b.index)
	const remaining = siblings.filter((page) => page.id !== source.id)
	const targetIndex = remaining.findIndex((page) => page.id === target.id)
	if (targetIndex < 0 || !siblings.some((page) => page.id === source.id)) return []
	remaining.splice(targetIndex + (edge === 'bottom' ? 1 : 0), 0, source)
	if (remaining.every((page, index) => page.id === siblings[index].id)) return []
	return remaining.flatMap((page, index) => (page.index === index + firstIndex ? [] : [{ id: page.id, index: index + firstIndex }]))
}
