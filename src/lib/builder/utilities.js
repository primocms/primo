import { customAlphabet } from 'nanoid/non-secure'
import _ from 'lodash-es'

export function createUniqueID(length = 5) {
	const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length)
	return nanoid()
}

// https://stackoverflow.com/a/21071454
export function move(array, from, to) {
	if (to === from) return array

	var target = array[from]
	var increment = to < from ? -1 : 1

	for (var k = from; k != to; k += increment) {
		array[k] = array[k + increment]
	}
	array[to] = target
	return array
}

export function replaceDashWithUnderscore(str) {
	return str.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
}

export function validate_url(url) {
	return url
		.replace(/\s+/g, '-')
		.replace(/[^0-9a-z\-._]/gi, '')
		.toLowerCase()
}

export function content_editable(element, params) {
	let value = element.textContent
	element.contentEditable = true
	element.spellcheck = false

	element.onfocus = () => {
		const range = document.createRange()
		const sel = window.getSelection()
		range.setStart(element, 1)
		range.collapse(true)

		sel?.removeAllRanges()
		sel?.addRange(range)
	}

	if (params.autofocus) element.focus()

	element.onkeydown = (e) => {
		if (e.code === 'Enter') {
			e.preventDefault()
			e.target?.blur()
			params.on_submit(value)
		}
	}

	element.onkeyup = (e) => {
		value = e.target.textContent
		params.on_change(value)
	}
}

// detect whether the mouse is hovering outside of an element
export function hovering_outside(event, element) {
	if (!element) return false
	const rect = element.getBoundingClientRect()
	const is_outside =
		event.x >= Math.floor(rect.right) ||
		event.y >= Math.floor(rect.bottom) ||
		event.x <= Math.floor(rect.left) ||
		event.y <= Math.floor(rect.top)
	return is_outside
}

export function swap_array_item_index(arr, from, to) {
	let new_array = _.cloneDeep(arr)
	new_array[from] = arr[to]
	new_array[to] = arr[from]
	return new_array
}

export function clickOutside(node) {
	const handleClick = (event) => {
		if (node && !node.contains(event.target) && !event.defaultPrevented) {
			node.dispatchEvent(new CustomEvent('click_outside', node))
		}
	}

	document.addEventListener('click', handleClick, true)

	return {
		destroy() {
			document.removeEventListener('click', handleClick, true)
		}
	}
}

export function click_to_copy(node, value = null) {
	navigator.clipboard.writeText(value || node.innerText)
	node.addEventListener('click', () => {
		node.style.opacity = '0.5'
	})
}
