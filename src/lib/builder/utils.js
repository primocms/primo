import _, { chain as _chain, capitalize as _capitalize } from 'lodash-es'
import { customAlphabet } from 'nanoid/non-secure'

import { processors } from './component.js'

const componentsCache = new Map()
export async function processCode({ component, head = { code: '', data: {}}, buildStatic = true, format = 'esm', locale = 'en', hydrated = true }) {
	let css = ''
	if (component.css) {
		css = await processCSS(component.css || '')
	}

	const cacheKey = JSON.stringify({
		component,
		format,
		buildStatic,
		hydrated
	})

	if (componentsCache.has(cacheKey)) {
		return componentsCache.get(cacheKey)
	}

	const res = await processors.html({
		component: {
			...component,
			css
		},
		head,
		buildStatic,
		format,
		locale,
		hydrated
	})

	componentsCache.set(cacheKey, res)

	return res
}

const cssCache = new Map()
let requesting = new Set()
export async function processCSS(raw) {
	if (cssCache.has(raw)) {
		return cssCache.get(raw)
	} else if (requesting.has(raw)) {
		await new Promise((resolve) => {
			setTimeout(resolve, 200)
		})
		if (cssCache.has(raw)) {
			return cssCache.get(raw)
		}
	}

	let res
	try {
		requesting.add(raw)
		res = (await processors.css(raw)) || {}
	} catch (e) {
		console.error(e)
	}
	if (!res) {
		return ''
	} else if (res.error) {
		console.log('CSS Error:', res.error)
		return raw
	} else if (res.css) {
		cssCache.set(raw, res.css)
		requesting.delete(raw)
		return res.css
	}
}

// Lets us debounce from reactive statements
export function createDebouncer(time) {
	return _.debounce((val) => {
		const [fn, arg] = val
		fn(arg)
	}, time)
}

export function wrapInStyleTags(css, id) {
	return `<style type="text/css" ${id ? `id = "${id}"` : ''}>${css}</style>`
}

export function get_empty_value(field) {
	if (field.type === 'repeater') return null
	else if (field.type === 'group') return null
	else if (field.type === 'image')
		return {
			url: '',
			src: '',
			alt: '',
			size: null
		}
	else if (field.type === 'text') return ''
	else if (field.type === 'markdown') return { html: '', markdown: '' }
	else if (field.type === 'link')
		return {
			label: '',
			url: ''
		}
	else if (field.type === 'url') return ''
	else if (field.type === 'select') return ''
	else if (field.type === 'switch') return true
	else if (field.type === 'number') return 0

	else if (field.type === 'page-field') return null
	else if (field.type === 'site-field') return null
	else {
		console.warn('No placeholder set for field type', field.type)
		return ''
	}

	function getGroupValue(field) {
		return _chain(field.fields)
			.keyBy('key')
			.mapValues((field) => get_empty_value(field))
			.value()
	}
}

let converter, showdown, showdown_highlight
export async function convert_html_to_markdown(html) {
	if (converter) {
		return converter.makeMarkdown(html)
	} else {
		const modules = await Promise.all([import('showdown'), import('showdown-highlight')])
		showdown = modules[0].default
		showdown_highlight = modules[1].default
		converter = new showdown.Converter({
			extensions: [showdown_highlight()]
		})
		return converter.makeMarkdown(html)
	}
}

export async function convert_markdown_to_html(markdown) {
	if (converter) {
		return converter.makeHtml(markdown)
	} else {
		const modules = await Promise.all([import('showdown'), import('showdown-highlight')])
		showdown = modules[0].default
		showdown_highlight = modules[1].default
		converter = new showdown.Converter({
			extensions: [showdown_highlight()]
		})
		return converter.makeHtml(markdown)
	}
}

export function is_regex(str) {
	return /^\/.*\/$/.test(str)
}

export function createUniqueID(length = 5) {
	const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length)
	return nanoid()
}

export function compare_urls(url1, url2) {
	// Function to decode and normalize a URL
	function normalize_url(url) {
		// Decode the URL
		let decoded = decodeURIComponent(url)
		// Trim whitespace
		decoded = decoded.trim()
		// Remove any surrounding quotes
		decoded = decoded.replace(/^["']|["']$/g, '')
		// Normalize spaces in the path
		return decoded.replace(/ /g, '%20')
	}

	const normalizedURL1 = normalize_url(url1)
	const normalizedURL2 = normalize_url(url2)

	// Compare the normalized URLs
	return normalizedURL1 === normalizedURL2
}


export function debounce({ instant, delay }, wait = 200) {
	let timeout
	return (...args) => {
		instant(...args)
		clearTimeout(timeout)
		timeout = setTimeout(() => delay(...args), wait)
	}
}