<script module>
	const scrollPositions = new Map() // TODO: fix

	let libraries
	if (!import.meta.env.SSR) fetch_dev_libraries()

	async function fetch_dev_libraries() {
		libraries = {
			prettier: (await import('$lib/builder/libraries/prettier/prettier')).default,
			prettier_css: (await import('$lib/builder/libraries/prettier/parser-postcss')).default,
			prettier_babel: (await import('$lib/builder/libraries/prettier/parser-babel')).default,
			prettier_svelte: (await import('$lib/builder/libraries/prettier/prettier-svelte')).default
		}
	}
</script>

<script>
	import { flattenDeep as _flattenDeep } from 'lodash-es'
	import { createEventDispatcher } from 'svelte'
	import { createDebouncer } from '../../utils'
	const slowDebounce = createDebouncer(1000)
	import { abbreviationTracker } from '../../libraries/emmet/plugin'

	import { highlightedElement } from '../../stores/app/misc'
	import { code as site_code } from '../../stores/data/site'
	import page_type from '../../stores/data/page_type'
	import { basicSetup } from 'codemirror'
	import { EditorView, keymap } from '@codemirror/view'
	import { standardKeymap, indentWithTab } from '@codemirror/commands'
	import { EditorState, Compartment } from '@codemirror/state'
	import { oneDarkTheme, ThemeHighlighting } from './theme'
	import { svelteCompletions, cssCompletions, extract_css_variables } from './extensions/autocomplete'
	import { getLanguage } from './extensions'
	import highlight_active_line from './extensions/inspector'

	/**
	 * @typedef {Object} Props
	 * @property {any} [data]
	 * @property {string} [prefix]
	 * @property {string} [value]
	 * @property {string} [mode]
	 * @property {string} [style]
	 * @property {boolean} [debounce]
	 * @property {number} [selection]
	 */

	/** @type {Props} */
	let { data = {}, prefix = '', value = $bindable(''), mode = 'html', style = '', debounce = false, selection = $bindable(0) } = $props()

	const dispatch = createEventDispatcher()

	let Editor = $state()

	const detectModKey = EditorView.domEventHandlers({
		keydown(event, view) {
			if (event.metaKey) {
				// event.preventDefault()
				dispatch('modkeydown')
				return false // This prevents the event from further processing in the editor
			}
			return false // Allows the event to be handled normally by the editor
		},
		keyup(event, view) {
			if (!event.metaKey) {
				// event.preventDefault()
				dispatch('modkeyup')
				return false
			}
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
	let css_variables = $state(extract_css_variables($site_code.css + $page_type.css + value))

	const editor_state = EditorState.create({
		selection: {
			anchor: selection
		},
		doc: value,
		extensions: [
			abbreviationTracker(),
			language,
			oneDarkTheme,
			ThemeHighlighting,
			keymap.of([
				standardKeymap,
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
							dispatch('format')
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
			svelteCompletions(data),
			...(mode === 'css' ? [css_completions_compartment.of(cssCompletions(css_variables))] : [])
		]
	})

	// re-configure css-variables autocomplete when variables change
	$effect(() => {
		css_variables = extract_css_variables($site_code.css + $page_type.css + value)
	})
	$effect(() => {
		mode === 'css' &&
			Editor &&
			Editor.dispatch({
				effects: css_completions_compartment.reconfigure(cssCompletions(css_variables))
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

			formatted = libraries.prettier.formatWithCursor(code, {
				parser: mode,
				bracketSameLine: true,
				cursorOffset: position,
				plugins: [libraries.prettier_svelte, libraries.prettier_css, libraries.prettier_babel]
			})
			console.log({ formatted })
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
	<div bind:this={editorNode}></div>
</div>

<style lang="postcss">
	.codemirror-container {
		width: 100%;
		overflow-y: scroll;
		overscroll-behavior-x: contain; /* prevent from swiping back */
		font-family: 'Fira Code', monospace !important;
		height: calc(100% - 34px);
		position: relative;
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
		border-right: 1px solid var(--primo-color-brand);
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
</style>
