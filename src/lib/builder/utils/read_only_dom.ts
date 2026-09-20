import { read_only } from '$lib/pocketbase/author_mode'

type Original = { readOnly?: boolean; disabled?: boolean; contenteditable: string | null }

// Input types where `readonly` actually prevents editing. Everything else —
// checkbox, radio, color, range, file, and the button-like types — ignores it
// and has to be disabled instead.
const READONLY_CAPABLE_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'date', 'month', 'week', 'time', 'datetime-local', 'number'])

// Buttons that navigate rather than mutate (expand/collapse toggles) opt out.
// `contenteditable` matches every spelling ("true", "", "plaintext-only");
// elements that resolve to non-editable are skipped in lock() via
// isContentEditable, which also does the case-insensitive enumeration the CSS
// attribute match can't.
const LOCK_SELECTOR = 'input, textarea, select, button:not([data-browse-allowed]), [contenteditable]'
// Kept explicit rather than collapsed into LOCK_SELECTOR: unlock must also
// catch elements whose editable state was removed while locked.
const UNLOCK_SELECTOR = 'input, textarea, select, button:not([data-browse-allowed]), [contenteditable]'

/**
 * Svelte action that makes a field subtree read-only in Browse mode.
 *
 * Field types are pluggable (~20 of them, each wrapping a different primitive),
 * and several surfaces render them outside any single wrapper component, so the
 * restriction is applied to the rendered DOM rather than threaded through every
 * component as a prop.
 *
 * `readonly` is preferred over `disabled` wherever the element supports it, so
 * values stay selectable and keep their contrast — they're being shown for
 * inspection, not signalling an error. Checkboxes, radios, selects and buttons
 * have no `readonly`, so those are genuinely disabled: `pointer-events: none`
 * would still leave them reachable by Tab and activatable with Enter/Space.
 */
export function apply_read_only(node: HTMLElement) {
	// Remember what each control looked like before locking, so leaving Browse
	// mode restores its own state rather than a guessed default.
	const originals = new WeakMap<HTMLElement, Original>()

	function lock() {
		for (const el of node.querySelectorAll<HTMLElement>(LOCK_SELECTOR)) {
			if (el.hasAttribute('contenteditable') && !el.isContentEditable) continue
			if (!originals.has(el)) {
				originals.set(el, {
					readOnly: 'readOnly' in el ? (el as HTMLInputElement).readOnly : undefined,
					disabled: 'disabled' in el ? (el as HTMLInputElement).disabled : undefined,
					contenteditable: el.getAttribute('contenteditable')
				})
			}

			if (el instanceof HTMLInputElement) {
				// Allowlist rather than denylist: field types are pluggable, so an
				// input type that ignores `readonly` (button/submit/reset/image, or
				// anything added later) has to fall through to `disabled` instead of
				// silently staying live.
				if (READONLY_CAPABLE_INPUT_TYPES.has(el.type)) {
					el.readOnly = true
				} else {
					el.disabled = true
				}
			} else if (el instanceof HTMLTextAreaElement) {
				el.readOnly = true
			} else if (el instanceof HTMLSelectElement || el instanceof HTMLButtonElement) {
				el.disabled = true
			} else {
				el.setAttribute('contenteditable', 'false')
			}
		}
	}

	function unlock() {
		for (const el of node.querySelectorAll<HTMLElement>(UNLOCK_SELECTOR)) {
			const before = originals.get(el)
			if (!before) continue

			if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
				if (before.readOnly !== undefined) el.readOnly = before.readOnly
				if (before.disabled !== undefined) el.disabled = before.disabled
			} else if (el instanceof HTMLSelectElement || el instanceof HTMLButtonElement) {
				if (before.disabled !== undefined) el.disabled = before.disabled
			} else if (before.contenteditable === null) {
				el.removeAttribute('contenteditable')
			} else {
				el.setAttribute('contenteditable', before.contenteditable)
			}

			originals.delete(el)
		}
	}

	// Tracked explicitly rather than read off the store each time, so the
	// MutationObserver and the subscription always agree on the current mode.
	let locked = false

	function sync() {
		if (locked) lock()
		else unlock()
	}

	// Field subtrees mount lazily (repeaters, groups, conditional fields), so
	// re-apply whenever the rendered content changes — and whenever the mode
	// itself flips, since these components stay mounted across that change.
	const observer = new MutationObserver(sync)
	observer.observe(node, { childList: true, subtree: true })
	const unsubscribe = read_only.subscribe((value) => {
		locked = value
		sync()
	})

	return {
		destroy: () => {
			observer.disconnect()
			unsubscribe()
		}
	}
}
