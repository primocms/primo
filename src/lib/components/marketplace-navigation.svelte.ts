import { createDashboardScroll } from './dashboard-scroll'

// Browser-session navigation memory. Only written from client effects/actions.
export const marketplaceNavigation = $state<Record<string, string>>({ starters: '', blocks: '' })
const scrollPositions = new Map<string, number>()

/** Keep category-link memory alongside SvelteKit's per-history snapshots. */
export function createMarketplaceScroll() {
	return createDashboardScroll({ positions: scrollPositions })
}
