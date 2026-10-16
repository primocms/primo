import CSSParser from 'css-simple-parser'

// Extract word at position (for class name detection)
export function get_word_at_pos(doc, pos) {
	const word_chars = /[a-zA-Z0-9_-]/
	let start = pos
	let end = pos

	while (start > 0 && word_chars.test(doc[start - 1])) start--
	while (end < doc.length && word_chars.test(doc[end])) end++

	if (start === end) return null
	return { word: doc.slice(start, end), start, end }
}

// Check if position is inside a class attribute
export function is_in_class_attr(doc, pos) {
	const before = doc.slice(Math.max(0, pos - 200), pos)
	const class_match = before.match(/class\s*=\s*["']([^"']*)$/)
	return class_match !== null
}

// Get all class names that have styles defined in <style> blocks
export function get_styled_classes(doc) {
	const style_regex = new RegExp('<' + 'style[^>]*>([\\s\\S]*?)</' + 'style>', 'i')
	const style_match = doc.match(style_regex)
	if (!style_match) return new Set()

	const css = style_match[1]
	const classes = new Set()

	try {
		const ast = CSSParser.parse(css)
		CSSParser.traverse(ast, node => {
			if (node.selector) {
				const class_matches = node.selector.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
				if (class_matches) {
					for (const match of class_matches) {
						classes.add(match.slice(1))
					}
				}
			}
		})
	} catch (e) {
		// Ignore parse errors
	}

	return classes
}

// Parse CSS from style blocks and extract rules for a specific class
export function extract_styles_for_class(doc, class_name) {
	const style_regex = new RegExp('<' + 'style[^>]*>([\\s\\S]*?)</' + 'style>', 'i')
	const style_match = doc.match(style_regex)
	if (!style_match) return []

	const css = style_match[1]
	const rules = []
	const class_pattern = new RegExp(`\\.${class_name}(?:[.:\\s\\[,{]|$)`)

	try {
		const ast = CSSParser.parse(css)

		CSSParser.traverse(ast, node => {
			if (node.selector && class_pattern.test(node.selector)) {
				const original_full = ('source' in node && typeof node.source === 'string' ? node.source : stringify_node(node))
				rules.push({
					selector: node.selector,
					body: node.body || '',
					children: node.children || [],
					original_full
				})
			}
		})
	} catch (e) {
		console.warn('CSS parse error:', e)
	}

	return rules
}

// Stringify a CSS node back to text with proper indentation
export function stringify_node(node, indent = 0) {
	const tab = '  '.repeat(indent)
	const inner_tab = '  '.repeat(indent + 1)
	let result = `${tab}${node.selector} {\n`
	if (node.body) {
		const props = node.body.trim().split(';').filter(p => p.trim()).map(p => `${inner_tab}${p.trim()};`).join('\n')
		result += props + '\n'
	}
	if (node.children && node.children.length > 0) {
		for (const child of node.children) {
			result += '\n' + stringify_node(child, indent + 1) + '\n'
		}
	}
	result += `${tab}}`
	return result
}

// Get just the properties of a rule (no selector, no braces)
export function get_rule_properties(node) {
	if (!node.body) return ''
	return node.body.trim().split(';').filter(p => p.trim()).map(p => `${p.trim()};`).join('\n')
}

// Flatten rules - extract all nested rules with full selector paths
export function flatten_rules(rules) {
	const flat = []
	function traverse(node, parent_selector = '') {
		let full_selector
		if (parent_selector && node.selector.includes('&')) {
			full_selector = node.selector.replace(/&/g, parent_selector)
		} else {
			full_selector = parent_selector ? `${parent_selector} ${node.selector}` : node.selector
		}
		if (node.body && node.body.trim()) {
			flat.push({ selector: full_selector, body: node.body, original: node })
		}
		if (node.children) {
			for (const child of node.children) {
				traverse(child, full_selector)
			}
		}
	}
	for (const rule of rules) {
		traverse(rule)
	}
	return flat
}
