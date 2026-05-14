import * as _ from 'lodash-es'
import { customAlphabet } from 'nanoid/non-secure'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js' // https://highlightjs.org
import { generateHTML, generateJSON } from '@tiptap/core'
import { rich_text_extensions } from '$lib/builder/rich-text/extensions'

import { processors } from './component.js'

const utf8_decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null

function is_byte_array(value: unknown): value is number[] {
	return Array.isArray(value) && value.length > 0 && value.every(item => Number.isInteger(item) && item >= 0 && item <= 255)
}

// Spread-based String.fromCharCode throws RangeError on large arrays and only
// handles code points, not UTF-8 bytes. TextDecoder handles both safely.
function decode_bytes(bytes: number[]): string {
	const buf = Uint8Array.from(bytes)
	return utf8_decoder ? utf8_decoder.decode(buf) : String.fromCharCode.apply(null, Array.from(buf) as number[])
}

/**
 * Normalize entry values that may have been stored incorrectly as byte arrays.
 * YAML can marshal []byte as integer arrays, which need to be converted back to strings.
 */
export function normalize_entry_value(value: unknown): unknown {
	// Handle byte arrays (YAML sometimes marshals []byte as integer arrays)
	if (is_byte_array(value)) {
		const str = decode_bytes(value)
		// Try to parse as JSON first (might be serialized JSON)
		try {
			return JSON.parse(str)
		} catch {
			// Not valid JSON, return as string
			return str
		}
	}
	// Recursively normalize objects
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const normalized: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(value)) {
			normalized[k] = normalize_entry_value(v)
		}
		return normalized
	}
	// Recursively normalize arrays (but not byte arrays, handled above)
	if (Array.isArray(value)) {
		return value.map(item => normalize_entry_value(item))
	}
	return value
}

export async function processCode({
	component,
	head = { code: '', data: {} },
	buildStatic = true,
	format = 'esm',
	hydrated = true,
	runtime = []
}: {
	component: {
		head?: string
		html?: string
		css?: string
		js?: string
		data?: object
	}
	head?: { code: string; data: object }
	buildStatic?: boolean
	format?: 'esm'
	hydrated?: boolean
	runtime?: string[]
}) {
	let css = ''
	if (component.css) {
		try {
			css = await processCSS(component.css || '')
		} catch (error) {
			return {
				error: formatCssCompilationError(error)
			}
		}
	}

	const res = await processors.html({
		component: {
			...component,
			css
		},
		head,
		buildStatic,
		css: 'injected',
		format,
		hydrated,
		runtime
	})
	return res
}

const css_cache = new Map()
let requesting = new Set()

export class CssCompilationError extends Error {
	constructor(message, details = {}) {
		super(message)
		this.name = 'CssCompilationError'
		Object.assign(this, details)
	}
}

function toCssCompilationError(error) {
	if (error instanceof CssCompilationError) return error

	const message = typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Unknown CSS compilation error'

	const details = {}
	if (error && typeof error === 'object') {
		if ('line' in error && typeof error.line === 'number') {
			details.line = error.line
		}
		if ('column' in error && typeof error.column === 'number') {
			details.column = error.column
		}
		if ('reason' in error && typeof error.reason === 'string') {
			details.reason = error.reason
		}
	}

	return new CssCompilationError(message, details)
}

export async function processCSS(raw) {
	if (css_cache.has(raw)) {
		return css_cache.get(raw)
	} else if (requesting.has(raw)) {
		while (requesting.has(raw)) {
			await new Promise((resolve) => setTimeout(resolve, 25))
		}
		if (css_cache.has(raw)) {
			return css_cache.get(raw)
		}
	}

	let res
	try {
		requesting.add(raw)
		res = (await processors.css(raw)) || {}
	} catch (error) {
		throw toCssCompilationError(error)
	} finally {
		requesting.delete(raw)
	}

	if (!res) {
		return ''
	}

	if (res.error) {
		throw toCssCompilationError(res.error)
	}

	if (res.css) {
		css_cache.set(raw, res.css)
		return res.css
	}

	return ''
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
			size: null,
			width: null,
			height: null
		}
	else if (field.type === 'text') return ''
	else if (field.type === 'markdown') return ''
	else if (field.type === 'rich-text')
		return {
			type: 'doc',
			content: [{ type: 'paragraph' }]
		}
	else if (field.type === 'link')
		return {
			label: '',
			text: '',
			url: ''
		}
	else if (field.type === 'url') return ''
	else if (field.type === 'select') return ''
	else if (field.type === 'switch') return true
	else if (field.type === 'number') return 0
	else if (field.type === 'page-field') return null
	else if (field.type === 'site-field') return null
	else if (field.type === 'page') return null
	else if (field.type === 'page-list') return []
	else if (field.type === 'info') return null
	else if (field.type === 'icon') return ''
	else {
		console.warn('No empty set for field type', field.type)
		return ''
	}
}
let markdown_renderer
function get_markdown_renderer() {
	if (!markdown_renderer) {
		markdown_renderer = new MarkdownIt({
			html: true,
			linkify: true,
			typographer: true,
			highlight: function (str, lang) {
				if (lang && hljs.getLanguage(lang)) {
					try {
						return '<pre><code class="hljs">' + hljs.highlight(str, { language: lang, ignoreIllegals: true }).value + '</code></pre>'
					} catch (__) { }
				}

				return '<pre><code class="hljs">' + markdown_renderer.utils.escapeHtml(str) + '</code></pre>'
			}
		})
	}
	return markdown_renderer
}

const markdown_cache = new Map()
export function convert_markdown_to_html(markdown = '') {
	if (markdown_cache.has(markdown)) return markdown_cache.get(markdown)
	try {
		const html = get_markdown_renderer().render(markdown)
		markdown_cache.set(markdown, html)
		return html
	} catch (error) {
		console.error('Failed to convert markdown to html', error)
		return ''
	}
}

const rich_text_cache = new Map()
export function convert_rich_text_to_html(tiptap_obj) {
	if (rich_text_cache.has(tiptap_obj)) return rich_text_cache.get(tiptap_obj)
	try {
		// Check if tiptap_obj is a string instead of a proper TipTap object
		let processed_obj = tiptap_obj

		// Handle byte arrays (YAML sometimes marshals []byte as integer arrays)
		if (is_byte_array(tiptap_obj)) {
			const str = decode_bytes(tiptap_obj)
			// Try to parse as JSON first (it might be a JSON string of TipTap content)
			try {
				processed_obj = JSON.parse(str)
			} catch {
				// Not valid JSON, treat as markdown
				const html = convert_markdown_to_html(str)
				processed_obj = generateJSON(html, rich_text_extensions)
			}
		} else if (typeof tiptap_obj === 'string') {
			// Assume it's markdown and convert to HTML first, then to TipTap JSON
			const html = convert_markdown_to_html(tiptap_obj)
			processed_obj = generateJSON(html, rich_text_extensions)
		}

		const html = generateHTML(processed_obj, rich_text_extensions)
		rich_text_cache.set(tiptap_obj, html)
		return html
	} catch (error) {
		console.error('Failed to render rich text content', { error, tiptap_obj })
		return ''
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

function formatCssCompilationError(error) {
	const baseMessage =
		typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Unknown CSS compilation error'

	if (!error || typeof error !== 'object') {
		return `CSS Error: ${baseMessage}`
	}

	const positions = []
	if ('line' in error && typeof error.line === 'number') {
		positions.push(`line ${error.line}`)
	}
	if ('column' in error && typeof error.column === 'number') {
		positions.push(`column ${error.column}`)
	}

	const suffix = positions.length ? ` (${positions.join(', ')})` : ''

	return `CSS Error: ${baseMessage}${suffix}`
}
