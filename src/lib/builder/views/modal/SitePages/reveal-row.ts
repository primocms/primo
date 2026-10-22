import { tick } from 'svelte'

export async function revealRow(container: HTMLElement, pageId?: string) {
	await tick()
	// Subpage forms slide closed and siblings animate into place. Measure only
	// after those finish, so the final row doesn't end up clipped again.
	const list = container.closest('.page-list:not(.child)') ?? container
	const animations = list.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
	await Promise.allSettled(animations.map((animation) => animation.finished))

	const row = pageId ? container.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`) : container
	if (row?.isConnected && row.getClientRects().length > 0) row.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
