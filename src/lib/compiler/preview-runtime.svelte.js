import { flushSync, mount, unmount } from 'svelte'

// Compiled into the preview's bundle so these props and the component use the
// same Svelte runtime. Plain postMessage objects aren't reactive on their own.
export function createPreview(component, { target, props: initial }) {
	const props = $state({})
	function update(next) {
		flushSync(() => {
			for (const key of Object.keys(props)) {
				if (!Object.prototype.hasOwnProperty.call(next, key)) delete props[key]
			}
			for (const [key, value] of Object.entries(next)) {
				// Keep unchanged objects stable too (images, rich text, repeaters).
				if (!equal(props[key], value)) props[key] = value
			}
		})
	}
	update(initial)
	let instance
	try {
		instance = mount(component, { target, props })
		flushSync()
	} catch (error) {
		if (instance) unmount(instance)
		throw error
	}
	return { update, destroy: () => unmount(instance) }
}

function equal(a, b) {
	if (Object.is(a, b)) return true
	if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
	if (Array.isArray(a) !== Array.isArray(b)) return false
	const keys = Object.keys(a)
	return keys.length === Object.keys(b).length && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]))
}
