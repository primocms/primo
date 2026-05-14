<script module>
	const scrollPositions = new Map() // TODO: fix
</script>

<script>
	import { createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import { createDebouncer } from '../../utils'
	import { highlightedElement, mod_key_held } from '../../stores/app/misc'
	import { basicSetup } from 'codemirror'
	import { EditorView, keymap, ViewPlugin, Decoration } from '@codemirror/view'
	import { standardKeymap, indentWithTab } from '@codemirror/commands'
	import { EditorState, Compartment } from '@codemirror/state'
	import { autocompletion } from '@codemirror/autocomplete'
	import { vsCodeDark } from './theme'
	import Icon from '@iconify/svelte'
	import { svelteCompletions, cssCompletions } from './extensions/autocomplete'
	import { getLanguage } from './extensions'
	import highlight_active_line from './extensions/inspector'
	import { emmetExtension, expandAbbreviation } from './extensions/emmet'
	import prettier from 'prettier'
	import * as prettierPostcss from 'prettier/plugins/postcss'
	import * as prettierBabel from 'prettier/plugins/babel'
	import * as prettierEstree from 'prettier/plugins/estree'
	import * as prettierSvelte from 'prettier-plugin-svelte/browser'
	import { get_word_at_pos, is_in_class_attr, get_styled_classes, extract_styles_for_class, get_rule_properties, flatten_rules } from './css-utils.js'

	const slowDebounce = createDebouncer(1000)

	// Class style tooltip state
	let tooltip_visible = $state(false)
	let tooltip_x = $state(0)
	let tooltip_y = $state(0)
	let tooltip_class = $state('')
	let tooltip_editable = $state(false)
	let tooltip_rules = $state([])
	let tooltip_editor_views = $state([]) // Array of {element, view, rule}
	let tooltip_save_timeout = $state(null)

	function hide_tooltip() {
		if (tooltip_save_timeout) {
			clearTimeout(tooltip_save_timeout)
			tooltip_save_timeout = null
		}
		for (const ev of tooltip_editor_views) {
			if (ev.view) ev.view.destroy()
		}
		tooltip_editor_views = []
		tooltip_visible = false
		tooltip_editable = false
	}

	function goto_rule(rule) {
		if (!Editor) return
		const doc = Editor.state.doc.toString()
		const selector = rule.original.selector
		const selector_escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		const pattern = new RegExp(selector_escaped + '\\s*\\{')
		const match = doc.match(pattern)
		if (match && match.index !== undefined) {
			const pos = match.index
			Editor.dispatch({
				selection: { anchor: pos, head: pos + selector.length },
				scrollIntoView: true
			})
			Editor.focus()
			hide_tooltip()
		}
	}

	function debounced_tooltip_save() {
		if (tooltip_save_timeout) clearTimeout(tooltip_save_timeout)
		tooltip_save_timeout = setTimeout(() => {
			save_tooltip_styles_silent()
		}, 500)
	}

	function save_tooltip_styles_silent() {
		if (!Editor || !tooltip_editor_views.length) return

		let doc = Editor.state.doc.toString()

		try {
			// Process rules in reverse order (deepest nested first) to avoid position invalidation
			const views_reversed = [...tooltip_editor_views].reverse()
			for (const ev of views_reversed) {
				if (!ev.view || !ev.rule) continue

				const new_props = ev.view.state.doc.toString().trim()
				const selector = ev.rule.original.selector

				// Find the original rule by its selector
				const selector_escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				const rule_pattern = new RegExp(selector_escaped + '\\s*\\{', 'g')
				const match = rule_pattern.exec(doc)

				if (match) {
					const brace_start = doc.indexOf('{', match.index)

					// Find where body ends (before nested rules or closing brace)
					let body_end = brace_start + 1
					let depth = 1
					let found_nested = false
					let nested_brace_pos = -1

					// Scan for the body content end (stops at nested { or final })
					for (let i = brace_start + 1; i < doc.length && depth > 0; i++) {
						if (doc[i] === '{') {
							if (!found_nested) {
								nested_brace_pos = i
								found_nested = true
							}
							depth++
						} else if (doc[i] === '}') {
							depth--
							if (depth === 0 && !found_nested) {
								body_end = i
							}
						}
					}

					// If we found a nested rule, scan back to find where its selector starts
					if (found_nested && nested_brace_pos > 0) {
						// Find the last semicolon or opening brace before the nested selector
						let selector_start = nested_brace_pos
						for (let i = nested_brace_pos - 1; i > brace_start; i--) {
							if (doc[i] === ';' || doc[i] === '{') {
								selector_start = i + 1
								break
							}
						}
						// Skip whitespace after ; or {
						while (selector_start < nested_brace_pos && /\s/.test(doc[selector_start])) {
							selector_start++
						}
						// Go back to include the newline before selector
						const newline_before = doc.lastIndexOf('\n', selector_start - 1)
						if (newline_before > brace_start) {
							body_end = newline_before
						} else {
							body_end = selector_start
						}
					}

					// Get original indentation
					const line_start = doc.lastIndexOf('\n', match.index) + 1
					const original_line = doc.slice(line_start, match.index)
					const base_indent = original_line.match(/^\s*/)?.[0] || ''
					const prop_indent = base_indent + '  '

					// Format new properties with proper indentation
					const formatted_props = new_props
						.split('\n')
						.filter((p) => p.trim())
						.map((p) => `${prop_indent}${p.trim()}`)
						.join('\n')

					const replacement = `\n${formatted_props}`
					doc = doc.slice(0, brace_start + 1) + replacement + doc.slice(body_end)
				}
			}

			Editor.dispatch({
				changes: { from: 0, to: Editor.state.doc.length, insert: doc }
			})
		} catch (e) {
			console.warn('CSS save error:', e)
		}
	}

	function show_class_tooltip(event, view) {
		const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
		if (pos === null) return

		const doc = view.state.doc.toString()
		const word_info = get_word_at_pos(doc, pos)

		if (!word_info) return
		if (!is_in_class_attr(doc, pos)) return

		// Cleanup existing editors
		for (const ev of tooltip_editor_views) {
			if (ev.view) ev.view.destroy()
		}
		tooltip_editor_views = []
		if (tooltip_save_timeout) {
			clearTimeout(tooltip_save_timeout)
			tooltip_save_timeout = null
		}

		const rules = extract_styles_for_class(doc, word_info.word)
		const flat_rules = flatten_rules(rules)
		tooltip_class = word_info.word
		tooltip_rules = flat_rules
		tooltip_editable = flat_rules.length > 0

		const editor_rect = element.getBoundingClientRect()
		const tooltip_width = 320
		const tooltip_height = 280

		// Account for scroll offset
		let x = event.clientX - editor_rect.left + element.scrollLeft + 10
		let y = event.clientY - editor_rect.top + element.scrollTop + 10

		if (event.clientX + tooltip_width + 20 > window.innerWidth) {
			x = event.clientX - editor_rect.left + element.scrollLeft - tooltip_width - 10
		}
		if (event.clientY + tooltip_height + 20 > window.innerHeight) {
			y = event.clientY - editor_rect.top + element.scrollTop - tooltip_height - 10
		}

		tooltip_x = Math.max(10, x)
		tooltip_y = Math.max(10 + element.scrollTop, y)
		tooltip_visible = true

		if (tooltip_editable) {
			requestAnimationFrame(() => {
				init_tooltip_editors()
			})
		}
	}

	function create_rule_editor(container, rule, index) {
		if (!container) return null

		const props = get_rule_properties(rule.original)

		// Simple highlighter for CSS properties (property: value;)
		const prop_mark = Decoration.mark({ class: 'cm-css-property' })
		const value_mark = Decoration.mark({ class: 'cm-css-value' })

		function create_css_decorations(v) {
			const decorations = []
			const doc = v.state.doc
			const text = doc.toString()

			// Match property: value patterns
			const pattern = /([a-z-]+)\s*:\s*([^;]+);?/gi
			let match
			while ((match = pattern.exec(text)) !== null) {
				const prop_start = match.index
				const prop_end = prop_start + match[1].length
				const colon_pos = text.indexOf(':', prop_end)
				const value_start = colon_pos + 1
				// Skip whitespace after colon
				let actual_value_start = value_start
				while (actual_value_start < text.length && /\s/.test(text[actual_value_start])) actual_value_start++
				const value_end = match.index + match[0].length - (match[0].endsWith(';') ? 1 : 0)

				decorations.push(prop_mark.range(prop_start, prop_end))
				if (actual_value_start < value_end) {
					decorations.push(value_mark.range(actual_value_start, value_end))
				}
			}

			return Decoration.set(decorations.sort((a, b) => a.from - b.from))
		}

		const css_highlighter = ViewPlugin.fromClass(
			class {
				constructor(v) {
					this.decorations = create_css_decorations(v)
				}
				update(update) {
					if (update.docChanged) this.decorations = create_css_decorations(update.view)
				}
			},
			{ decorations: (v) => v.decorations }
		)

		const view = new EditorView({
			state: EditorState.create({
				doc: props,
				extensions: [
					basicSetup,
					css_highlighter,
					vsCodeDark,
					EditorView.theme({
						'&': { fontSize: '12px' },
						'.cm-scroller': { overflow: 'auto', fontFamily: 'Fira Code, monospace' },
						'.cm-content': { padding: '6px 8px' },
						'.cm-gutters': { display: 'none' },
						'.cm-lineNumbers': { display: 'none' },
						'.cm-activeLine': { backgroundColor: 'transparent !important' },
						'.cm-activeLineGutter': { backgroundColor: 'transparent !important' },
						'.cm-css-property': { color: 'rgb(156, 220, 254)' },
						'.cm-css-value': { color: 'rgb(206, 145, 120)' }
					}),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) debounced_tooltip_save()
					})
				]
			}),
			parent: container
		})

		return { view, rule, index }
	}

	function init_tooltip_editors() {
		// Cleanup old views
		for (const ev of tooltip_editor_views) {
			if (ev.view) ev.view.destroy()
		}
		tooltip_editor_views = []

		// Create new editors for each rule
		const containers = document.querySelectorAll('.tooltip-rule-editor')
		containers.forEach((container, i) => {
			if (tooltip_rules[i]) {
				const ev = create_rule_editor(container, tooltip_rules[i], i)
				if (ev) tooltip_editor_views.push(ev)
			}
		})
	}

	/**
	 * @typedef {Object} Props
	 * @property {any} [data]
	 * @property {string} [prefix]
	 * @property {string} [value]
	 * @property {string} [mode]
	 * @property {string} [style]
	 * @property {boolean} [debounce]
	 * @property {number} [selection]
	 * @property {boolean} [disabled]
	 */

	/** @type {Props} */
	let { data = {}, completions, prefix = '', value = $bindable(''), mode = 'html', style = '', debounce = false, selection = $bindable(0), disabled = false } = $props()

	const dispatch = createEventDispatcher()

	let Editor = $state()
	let is_focused = $state(false)

	const detectModKey = EditorView.domEventHandlers({
		keydown(event, view) {
			if (event.metaKey) {
				dispatch('modkeydown')
				return false
			}
			return false
		},
		keyup(event, view) {
			if (!event.metaKey) {
				dispatch('modkeyup')
				return false
			}
			return false
		},
		focus(event, view) {
			is_focused = true
			return false
		},
		blur(event, view) {
			is_focused = false
			return false
		},
		contextmenu(event, view) {
			// Check if we're on a class name before preventing default
			const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
			if (pos !== null) {
				const doc = view.state.doc.toString()
				const word_info = get_word_at_pos(doc, pos)
				if (word_info && is_in_class_attr(doc, pos)) {
					event.preventDefault()
					show_class_tooltip(event, view)
					return true
				}
			}
			return false
		},
		click(event, view) {
			hide_tooltip()
			return false
		}
	})

	$effect(() => {
		if (Editor && value !== Editor.state.doc.toString()) {
			const old_value = Editor.state.doc.toString()
			Editor.dispatch({
				changes: [
					{
						from: 0,
						to: old_value.length,
						insert: value
					}
				],
				selection: {
					anchor: 0
				}
			})
		}
	})

	const language = getLanguage(mode)

	const css_completions_compartment = new Compartment()
	const svelte_completions_compartment = new Compartment()
	let css_variables = $state([])

	// Decoration for classes that have styles defined (underline them)
	const styled_class_mark = Decoration.mark({ class: 'cm-styled-class' })

	function create_styled_class_decorations(view) {
		const decorations = []
		const doc = view.state.doc.toString()
		const styled_classes = get_styled_classes(doc)

		if (styled_classes.size === 0) return Decoration.set([])

		// Find all class attributes and underline classes that have styles
		const class_attr_pattern = /class\s*=\s*["']([^"']+)["']/gi
		let match
		while ((match = class_attr_pattern.exec(doc)) !== null) {
			const classes_str = match[1]
			const attr_start = match.index + match[0].indexOf(match[1])

			// Find each class name within the attribute
			let pos = 0
			for (const class_name of classes_str.split(/\s+/)) {
				if (!class_name) {
					pos++
					continue
				}
				const class_start = classes_str.indexOf(class_name, pos)
				if (class_start >= 0 && styled_classes.has(class_name)) {
					const from = attr_start + class_start
					const to = from + class_name.length
					decorations.push(styled_class_mark.range(from, to))
				}
				pos = class_start + class_name.length
			}
		}

		return Decoration.set(decorations.sort((a, b) => a.from - b.from))
	}

	const styled_class_highlighter = ViewPlugin.fromClass(
		class {
			constructor(view) {
				this.decorations = create_styled_class_decorations(view)
			}
			update(update) {
				if (update.docChanged) this.decorations = create_styled_class_decorations(update.view)
			}
		},
		{ decorations: (v) => v.decorations }
	)

	const editor_state = EditorState.create({
		selection: {
			anchor: selection
		},
		doc: value,
		extensions: [
			EditorState.readOnly.of(disabled),
			language,
			vsCodeDark,
			keymap.of([
				...standardKeymap,
				...(mode !== 'javascript'
					? [
							{
								key: 'Tab',
								run: expandAbbreviation
							}
						]
					: []),
				indentWithTab,
				{
					key: 'Escape',
					run: () => {
						Editor.contentDOM.blur()
						return true
					}
				},
				{
					key: 'mod-e',
					run: () => {
						dispatch('mod-e')
						return true
					}
				},
				{
					key: 'mod-r',
					run: () => {
						dispatch('mod-r')
						return true
					}
				},
				{
					key: 'mod-1',
					run: () => {
						dispatch('tab-switch', 0)
						return true
					}
				},
				{
					key: 'mod-2',
					run: () => {
						dispatch('tab-switch', 1)
						return true
					}
				},
				{
					key: 'mod-3',
					run: () => {
						dispatch('tab-switch', 2)
						return true
					}
				},
				{
					key: 'mod-s',
					run: () => {
						dispatch('save')
						return true
					}
				},
				{
					key: 'mod-r',
					run: () => {
						dispatch('refresh')
						return true
					}
				},
				{
					key: 'mod-Enter',
					run: () => {
						const value = Editor.state.doc.toString()
						const position = Editor.state.selection.main.head
						format_code(value, { mode, position }).then((res) => {
							if (!res) return
							const { formatted, cursorOffset } = res
							Editor.dispatch({
								changes: [
									{
										from: 0,
										to: Editor.state.doc.length,
										insert: formatted
									}
								],
								selection: {
									anchor: cursorOffset
								}
							})
							dispatchChanges(formatted)
						})
						return true
					}
				}
			]),
			detectModKey,
			EditorView.updateListener.of((view) => {
				if (view.docChanged) {
					const newValue = view.state.doc.toString()
					value = newValue.replace(prefix, '')
					if (debounce) {
						slowDebounce([dispatchChanges, value])
					} else {
						dispatchChanges(value)
					}
				}
				selection = view.state.selection.main.from
			}),
			basicSetup,
			...(mode === 'html' ? [svelte_completions_compartment.of(autocompletion({ override: [svelteCompletions(completions)] })), styled_class_highlighter] : []),
			...(mode === 'css' ? [css_completions_compartment.of(cssCompletions(css_variables))] : []),
			...(mode !== 'javascript' ? [emmetExtension(mode === 'css' ? 'css' : 'html')] : [])
		]
	})

	$effect(() => {
		mode === 'css' &&
			Editor &&
			Editor.dispatch({
				effects: css_completions_compartment.reconfigure(cssCompletions(css_variables))
			})
	})

	$effect(() => {
		mode === 'html' &&
			Editor &&
			Editor.dispatch({
				effects: svelte_completions_compartment.reconfigure(autocompletion({ override: [svelteCompletions(completions)] }))
			})
	})

	$effect(() => {
		mode === 'html' && Editor && highlight_active_line(Editor, $highlightedElement)
	})

	async function format_code(code, { mode, position }) {
		let formatted
		try {
			if (mode === 'javascript') {
				mode = 'babel'
			} else if (mode === 'html') {
				mode = 'svelte'
			}

			formatted = prettier.formatWithCursor(code, {
				parser: mode,
				bracketSameLine: true,
				cursorOffset: position,
				plugins: [prettierSvelte, prettierPostcss, prettierBabel, prettierEstree]
			})
		} catch (e) {
			console.warn(e)
		}
		return formatted
	}

	let editorNode = $state()
	$effect(() => {
		if (editorNode) {
			Editor = new EditorView({
				state: editor_state,
				parent: editorNode
			})
		}
	})

	function dispatchChanges(value) {
		dispatch('change', value)
	}

	let element = $state()
	$effect(() => {
		if (element) {
			if (scrollPositions.has(value)) {
				element.scrollTo(0, scrollPositions.get(value))
			}
			element.addEventListener('scroll', () => {
				scrollPositions.set(value, element.scrollTop)
			})
		}
	})
</script>

<svelte:window
	onresize={() => {
		// Editor.setSize(null, editorNode.clientHeight)
	}}
/>

<div bind:this={element} class="codemirror-container {mode}" {style}>
	<div class="editor-wrapper">
		<div bind:this={editorNode}></div>
		{#if $mod_key_held && is_focused}
			<div class="format-hint">
				<span>&#8984;</span>
				<span>↵</span>
				<span>Format</span>
			</div>
		{/if}
		{#if tooltip_visible}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="class-tooltip" style="left: {tooltip_x}px; top: {tooltip_y}px;" transition:fade={{ duration: 100 }} onclick={(e) => e.stopPropagation()}>
				<button class="tooltip-close-btn" onclick={hide_tooltip}>×</button>
				{#if tooltip_editable}
					<div class="tooltip-rules-container">
						{#each tooltip_rules as rule, i}
							<div class="tooltip-rule">
								<button class="tooltip-rule-header" onclick={() => goto_rule(rule)}>
									<span class="tooltip-rule-selector">{rule.selector}</span>
								</button>
								<div class="tooltip-rule-editor"></div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="tooltip-empty">No styles found for .{tooltip_class}</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.codemirror-container {
		width: 100%;
		overflow-y: scroll;
		overscroll-behavior-x: contain; /* prevent from swiping back */
		font-family: 'Fira Code', monospace !important;
		/* height: calc(100% - 34px); */
		height: 100%; /* making full height for page type head html, can't remember what -34px was for */
	}

	.editor-wrapper {
		position: relative;
	}

	.format-hint {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: var(--color-gray-9);
		border: 1px solid var(--color-gray-8);
		padding: 0.5rem 0.75rem;
		border-radius: var(--primo-border-radius);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-gray-2);
		pointer-events: none;
		z-index: 10;
	}

	:global(.highlighted) {
		background: var(--color-gray-6);
		/* color: white; */
		border-radius: 2px;
	}

	:global(.ͼu) {
		color: rgb(86, 156, 214);
	}

	:global(.cm-tooltip-autocomplete) {
		color: var(--color-gray-9) !important;
		background: var(--color-gray-8);
		border-radius: 3px;
		overflow: hidden;
	}

	:global(.ͼo .cm-tooltip-autocomplete > ul > li) {
		padding: 0.5rem !important;
		font-size: 0.75rem;
		color: var(--color-gray-1);
		transition: 0.1s background;
	}

	:global(.ͼo .cm-tooltip-autocomplete > ul > li[aria-selected='true'], .ͼo .cm-tooltip-autocomplete > ul > li:hover) {
		color: white;
		background: var(--color-gray-7);
		transition:
			0.1s background,
			0.1s color;
	}

	:global(.ͼo .cm-tooltip-autocomplete > ul > li .cm-completionLabel) {
		padding: 3px 8px;
		border-right: 1px solid var(--primo-primary-color);
		color: white;
		font-size: 0.75rem;
		font-family: 'Fira Code';
	}

	:global(.ͼo .cm-tooltip-autocomplete > ul > li .cm-completionDetail) {
		font-size: 0.75rem;
		margin-left: 0.5rem;
		font-family: system-ui;
		font-style: normal;
	}

	/* Ensure emmet popup doesn't get cut off */
	:global(.cm-scroller) {
		/* overflow-y: visible !important;
    overflow-x: auto !important; */
	}

	:global(.emmet-preview) {
		background: var(--color-gray-9) !important;
		padding: 0.5rem !important;
		margin-left: 0 !important;
		margin-top: 1.5rem !important;
		border-top-right-radius: 0 !important;
		border-top-left-radius: 0 !important;
	}

	/* Class style tooltip */
	.class-tooltip {
		position: absolute;
		background: var(--primo-color-black);
		border: 1px solid var(--color-gray-8);
		border-radius: 6px;
		padding: 0;
		z-index: 100;
		min-width: 300px;
		max-width: 450px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}

	.tooltip-close-btn {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		padding: 0.125rem 0.375rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		background: transparent;
		color: var(--color-gray-5);
		font-size: 0.875rem;
		line-height: 1;
		z-index: 1;
	}

	.tooltip-close-btn:hover {
		color: white;
	}

	.tooltip-rules-container {
		max-height: 300px;
		overflow: auto;
	}

	.tooltip-rule {
		border-bottom: 1px solid var(--color-gray-8);
	}

	.tooltip-rule:last-child {
		border-bottom: none;
	}

	.tooltip-rule-header {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.375rem 0.75rem;
		background: var(--color-gray-9);
		border: none;
		cursor: pointer;
		transition: background 0.15s;
	}

	.tooltip-rule-header:hover {
		background: var(--color-gray-8);
	}

	.tooltip-rule-header:hover .tooltip-rule-selector {
		color: var(--primo-primary-color);
	}

	.tooltip-rule-selector {
		font-size: 0.7rem;
		font-family: 'Fira Code', monospace;
		color: var(--color-gray-4);
		transition: color 0.15s;
	}

	.tooltip-rule-editor :global(.cm-editor) {
		background: var(--primo-color-black);
	}

	.tooltip-rule-editor :global(.cm-focused) {
		outline: none;
	}

	.tooltip-empty {
		padding: 1rem;
		color: var(--color-gray-4);
		font-size: 0.75rem;
		text-align: center;
	}

	/* Underline for classes that have styles defined */
	:global(.cm-styled-class) {
		text-decoration: underline;
		text-decoration-style: dotted;
		text-decoration-color: var(--color-gray-5);
	}
</style>
