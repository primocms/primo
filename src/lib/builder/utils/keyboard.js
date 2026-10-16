import { browser } from '$app/environment'
import { PressedKeys } from 'runed'

/**
 * Register a cross-platform keyboard shortcut (Cmd on Mac, Ctrl on Windows/Linux)
 * @param {string | string[]} key - Key or keys to combine with modifier
 * @param {() => void} callback - Function to call when shortcut is pressed
 */
export function onModKey(key, callback) {
	const pressed_keys = new PressedKeys()

	const keyArray = Array.isArray(key) ? key : [key]

	const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
	if (isMac) {
		// Mac: Cmd + key
		pressed_keys.onKeys(['meta', ...keyArray], callback)
	} else {
		// Windows/Linux: Ctrl + key
		pressed_keys.onKeys(['control', ...keyArray], callback)
	}

	// Always prevent default for modifier+key combinations
	const keyString = keyArray[keyArray.length - 1].toLowerCase()

	window.addEventListener('keydown', (e) => {
		const modKey = isMac ? e.metaKey : e.ctrlKey
		if (modKey && e.key.toLowerCase() === keyString) {
			e.preventDefault()
		}
	})
}

/**
 * Check if the mod key (Cmd on Mac, Ctrl on Windows/Linux) is pressed
 * @param {import('runed').PressedKeys} keys - PressedKeys instance
 * @returns {boolean}
 */
export function isModKeyPressed(keys) {
	if (!browser) return false

	const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
	return isMac ? keys.has('Meta') : keys.has('Control')
}
