import type { Modifier } from '@popperjs/core'

export const offsetByFixedParents: Partial<Modifier<string, Record<string, unknown>>> = {
	name: 'offsetByFixedParents',
	enabled: true,
	phase: 'read',
	fn: ({ state }) => {
		if (state.options.strategy !== 'fixed' || state.elements.popper.matches(':popover-open')) {
			return
		}

		let el = state.elements.reference
		while (el instanceof HTMLElement && el.parentElement) {
			if (getComputedStyle(el.parentElement).position === 'fixed') {
				const rect = el.parentElement.getBoundingClientRect()
				if (state.modifiersData.popperOffsets) state.modifiersData.popperOffsets.x -= rect.x
				if (state.modifiersData.popperOffsets) state.modifiersData.popperOffsets.y -= rect.y
			}

			el = el.parentElement
		}
	}
}
