import { tick } from 'svelte'
import type { Snapshot } from '@sveltejs/kit'
import { beforeNavigate } from '$app/navigation'

type ScrollSnapshot = { key: string; top: number }
const reloadStorageKey = 'primo:dashboard-scroll-reload'
const editorReturnStorageKey = 'primo:sites-editor-return'
let checkedReload = false
let reloadSnapshot: (ScrollSnapshot & { url: string }) | undefined
let editorReturnSnapshot: (ScrollSnapshot & { url: string }) | undefined

function takeEditorReturnSnapshot(key: string): ScrollSnapshot | undefined {
	try {
		const saved = JSON.parse(sessionStorage.getItem(editorReturnStorageKey) ?? 'null')
		sessionStorage.removeItem(editorReturnStorageKey)
		if (saved?.url === location.href && typeof saved.key === 'string' && Number.isFinite(saved.top) && saved.top >= 0) editorReturnSnapshot = saved
	} catch {
		// History restoration remains available without browser storage.
	}
	if (editorReturnSnapshot?.url !== location.href) editorReturnSnapshot = undefined
	return editorReturnSnapshot?.key === key ? editorReturnSnapshot : undefined
}

function takeReloadSnapshot(key: string): ScrollSnapshot | undefined {
	if (!checkedReload) {
		checkedReload = true
		try {
			const saved = JSON.parse(sessionStorage.getItem(reloadStorageKey) ?? 'null')
			sessionStorage.removeItem(reloadStorageKey)
			const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
			if (navigation?.type === 'reload' && saved?.url === location.href && typeof saved.key === 'string' && Number.isFinite(saved.top) && saved.top >= 0) reloadSnapshot = saved
		} catch {
			// Scrolling still works when browser storage is unavailable.
		}
	}
	return reloadSnapshot?.url === location.href && reloadSnapshot.key === key ? reloadSnapshot : undefined
}

/** Restore dashboard scrolling after navigation, reload, and async previews. */
export function createDashboardScroll({
	selector,
	positions,
	windowScroll = false,
	siteEditorReturn = false
}: { selector?: string; positions?: Map<string, number>; windowScroll?: boolean; siteEditorReturn?: boolean } = {}) {
	// Authentication can refresh its record cache and remount the dashboard
	// during startup. Keep reload state through those mounts, then release it
	// on the first navigation so later visits use their own history entry.
	beforeNavigate((navigation) => {
		reloadSnapshot = undefined
		editorReturnSnapshot = undefined
		if (siteEditorReturn && navigation.to && /^\/admin\/(?:sites\/[^/]+|site)(?:\/|$)/.test(navigation.to.url.pathname)) {
			try {
				// Back/Forward changes window.location before this callback;
				// the router still identifies the list we are leaving.
				sessionStorage.setItem(editorReturnStorageKey, JSON.stringify({ ...capture(), url: navigation.from?.url.href ?? location.href }))
			} catch {
				// Opening an editor must still work when storage is restricted.
			}
		}
	})
	let root: HTMLElement | undefined
	let key = ''
	let pending: number | null = null
	let queuedSnapshot: ScrollSnapshot | undefined
	let ready = false
	let initialized = false
	let restorationFrame = 0
	let version = 0
	let observe = () => {}
	const scroller = () => (windowScroll ? (document.scrollingElement as HTMLElement | null) : selector ? root?.querySelector<HTMLElement>(selector) : root)
	const capture = (): ScrollSnapshot => ({ key, top: pending ?? scroller()?.scrollTop ?? 0 })
	const remember = () => {
		if (positions && root) positions.set(key, capture().top)
	}
	const restore = () => {
		if (!ready || pending === null) return
		cancelAnimationFrame(restorationFrame)
		const node = scroller()
		// Loading placeholders can be taller than the eventual cards. Don't
		// finish restoring until the real list has replaced them.
		if (!node || root?.querySelector('[data-slot="skeleton"], [role="status"]')) return
		node.scrollTop = pending
		// Each column grows independently as previews finish. Keep the target
		// through those changes so browser scroll anchoring cannot move it.
		if (Array.from(root?.querySelectorAll('.IFrame') ?? []).some((preview) => !preview.querySelector('iframe.fadein'))) return
		if (node.scrollHeight - node.clientHeight < pending) return
		const top = pending
		const currentVersion = version
		// Let the browser finish its own reload/layout scrolling before
		// reapplying the target. User input still cancels immediately.
		restorationFrame = requestAnimationFrame(() => {
			if (pending !== top || version !== currentVersion) return
			node.scrollTop = top
			restorationFrame = requestAnimationFrame(() => {
				if (pending !== top || version !== currentVersion) return
				node.scrollTop = top
				// A later preview relayout may clamp scrolling again.
				// Keep this target until real user input takes control.
			})
		})
	}
	const snapshot: Snapshot<ScrollSnapshot> = {
		capture() {
			remember()
			return capture()
		},
		restore(saved) {
			if (!saved) return
			saved = takeEditorReturnSnapshot(saved.key) ?? takeReloadSnapshot(saved.key) ?? saved
			if (!root || saved.key !== key) {
				queuedSnapshot = saved
				return
			}
			pending = saved.top
			restore()
		}
	}

	function action(node: HTMLElement, initialKey: string) {
		root = node
		// Dashboard pages mount after async authentication, after SvelteKit's
		// initial snapshot pass. Preserve reload state until this action mounts.
		queuedSnapshot = takeEditorReturnSnapshot(initialKey) ?? takeReloadSnapshot(initialKey) ?? queuedSnapshot
		const resize = new ResizeObserver(restore)
		observe = () => {
			resize.disconnect()
			resize.observe(node)
			const target = scroller()
			if (target) {
				resize.observe(target)
				for (const child of target.children) resize.observe(child)
			}
			restore()
		}
		const mutation = new MutationObserver(observe)
		mutation.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
		const onScroll = (event: Event) => {
			if (event.target !== scroller() && !(windowScroll && event.target === document)) return
			// Layout observers reapply a pending history target. Reapplying it
			// on every scroll would fight focus/scrollIntoView before a click.
			if (pending === null) {
				remember()
				if (reloadSnapshot?.key === key && reloadSnapshot.url === location.href) reloadSnapshot.top = capture().top
				if (editorReturnSnapshot?.key === key && editorReturnSnapshot.url === location.href) editorReturnSnapshot.top = capture().top
			}
		}
		const onInteraction = () => {
			cancelAnimationFrame(restorationFrame)
			pending = null
		}
		const onPageHide = () => {
			try {
				sessionStorage.setItem(reloadStorageKey, JSON.stringify({ ...capture(), url: location.href }))
			} catch {
				// A storage restriction must not prevent leaving the page.
			}
		}
		const scrollEvents = windowScroll ? window : node
		// Scroll doesn't bubble, so capture also covers a replaced masonry list.
		scrollEvents.addEventListener('scroll', onScroll, true)
		scrollEvents.addEventListener('wheel', onInteraction, { passive: true })
		scrollEvents.addEventListener('pointerdown', onInteraction)
		scrollEvents.addEventListener('keydown', onInteraction)
		window.addEventListener('pagehide', onPageHide)

		function update(nextKey: string) {
			// The route URL can settle again after the action mounts. Svelte
			// may call update with the same key; keep its restored position.
			if (initialized && nextKey === key) return
			initialized = true
			cancelAnimationFrame(restorationFrame)
			// The keyed cards may already have been removed here, clamping
			// scrollTop to zero. Scroll events/snapshot capture saved the old
			// group's position before that DOM replacement.
			key = nextKey
			pending = queuedSnapshot?.key === key ? queuedSnapshot.top : ((takeEditorReturnSnapshot(key) ?? takeReloadSnapshot(key))?.top ?? positions?.get(key) ?? 0)
			queuedSnapshot = undefined
			ready = false
			const currentVersion = ++version
			// An action update can precede replacement of the keyed group DOM.
			// Restoring against the departing group's height would finish early.
			tick().then(() => {
				if (version !== currentVersion || root !== node) return
				ready = true
				observe()
			})
		}
		update(initialKey)
		return {
			update,
			destroy() {
				cancelAnimationFrame(restorationFrame)
				version++
				root = undefined
				ready = false
				resize.disconnect()
				mutation.disconnect()
				scrollEvents.removeEventListener('scroll', onScroll, true)
				scrollEvents.removeEventListener('wheel', onInteraction)
				scrollEvents.removeEventListener('pointerdown', onInteraction)
				scrollEvents.removeEventListener('keydown', onInteraction)
				window.removeEventListener('pagehide', onPageHide)
			}
		}
	}
	return { action, snapshot }
}
