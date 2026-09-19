<script>
	import { createEventDispatcher } from 'svelte'
	import CodeMirror from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import { read_only } from '$lib/pocketbase/author_mode'

	const dispatch = createEventDispatcher()

	let {
		data = {},
		completions,
		html = $bindable(''),
		css = $bindable(''),
		js = $bindable(''),
		storage_key,
		onmod_e = () => {},
		onmod_r = () => {},
		oninput = () => {}
	} = $props()

	// Combine html/css/js into a single unified code string
	// Order: JS, HTML, CSS
	function merge_code(html_val, css_val, js_val) {
		let parts = []

		// Add script block if there's JS
		// Using array join to avoid confusing svelte preprocessor
		if (js_val && js_val.trim()) {
			parts.push(['<', 'script', '>\n', js_val, '\n</', 'script', '>'].join(''))
		}

		// Add HTML content
		if (html_val && html_val.trim()) {
			parts.push(html_val)
		}

		// Add style block if there's CSS
		if (css_val && css_val.trim()) {
			parts.push(['<', 'style', '>\n', css_val, '\n</', 'style', '>'].join(''))
		}

		return parts.join('\n\n')
	}

	// Parse unified code back into html/css/js
	// Using RegExp constructor to avoid confusing svelte preprocessor
	function parse_code(code) {
		let extracted_css = ''
		let extracted_js = ''
		let remaining_html = code

		// Extract style content
		const style_pattern = new RegExp('<' + 'style[^>]*>([\\s\\S]*?)</' + 'style>', 'i')
		const style_match = code.match(style_pattern)
		if (style_match) {
			extracted_css = style_match[1].trim()
			remaining_html = remaining_html.replace(style_match[0], '')
		}

		// Extract script content (but not script src=...)
		const script_pattern = new RegExp('<' + 'script(?![^>]*\\bsrc\\s*=)[^>]*>([\\s\\S]*?)</' + 'script>', 'i')
		const script_match = remaining_html.match(script_pattern)
		if (script_match) {
			extracted_js = script_match[1].trim()
			remaining_html = remaining_html.replace(script_match[0], '')
		}

		// Clean up extra whitespace from HTML
		remaining_html = remaining_html.trim()

		return { html: remaining_html, css: extracted_css, js: extracted_js }
	}

	// Initialize unified code from props
	let unified_code = $state(merge_code(html, css, js))

	// Track if we're currently syncing to avoid loops
	let syncing = false

	// When unified code changes, parse and update html/css/js
	function handle_code_change() {
		if (syncing) return
		syncing = true

		const parsed = parse_code(unified_code)
		html = parsed.html
		css = parsed.css
		js = parsed.js

		dispatch('htmlChange')
		dispatch('cssChange')
		dispatch('jsChange')
		oninput()

		syncing = false
	}
</script>

<div class="editor-container">
	<CodeMirror
		mode="html"
		{data}
		{completions}
		disabled={$read_only}
		bind:value={unified_code}
		on:mod-e
		on:mod-r
		on:change={handle_code_change}
		on:save
		on:refresh
	/>
</div>

<style lang="postcss">
	.editor-container {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}
</style>
