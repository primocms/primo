import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'

// Scroll the field panel, not the page canvas. Runs between native drag events
// so holding the handle near the edge keeps scrolling a long list.
export function repeaterAutoScroll(element: HTMLElement, scope: string) {
	let frame = 0
	let input: { clientX: number; clientY: number } | null = null
	function stop() {
		cancelAnimationFrame(frame)
		frame = 0
		input = null
	}
	function scroll() {
		if (!input) return
		for (let panel = element.parentElement; panel; panel = panel.parentElement) {
			if (!/(auto|scroll)/.test(getComputedStyle(panel).overflowY) || panel.scrollHeight <= panel.clientHeight) continue
			const rect = panel.getBoundingClientRect()
			if (input.clientX < rect.left || input.clientX > rect.right || input.clientY < rect.top - 20 || input.clientY > rect.bottom + 20) break
			const margin = Math.min(48, rect.height / 4)
			const velocity =
				input.clientY < rect.top + margin ? -Math.ceil((rect.top + margin - input.clientY) / 5) : input.clientY > rect.bottom - margin ? Math.ceil((input.clientY - rect.bottom + margin) / 5) : 0
			panel.scrollTop += Math.max(-12, Math.min(12, velocity))
			break
		}
		frame = requestAnimationFrame(scroll)
	}
	let cleanup = monitorForElements({
		canMonitor: ({ source }) => source.data.type === 'repeater-item' && source.data.scope === scope,
		onDragStart: ({ location }) => {
			input = location.current.input
			frame = requestAnimationFrame(scroll)
		},
		onDrag: ({ location }) => {
			input = location.current.input
		},
		onDrop: stop
	})
	return {
		update(next: string) {
			stop()
			cleanup()
			scope = next
			cleanup = monitorForElements({
				canMonitor: ({ source }) => source.data.type === 'repeater-item' && source.data.scope === scope,
				onDragStart: ({ location }) => {
					input = location.current.input
					frame = requestAnimationFrame(scroll)
				},
				onDrag: ({ location }) => {
					input = location.current.input
				},
				onDrop: stop
			})
		},
		destroy() {
			stop()
			cleanup()
		}
	}
}
