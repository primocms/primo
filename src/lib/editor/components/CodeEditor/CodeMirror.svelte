<script context="module">
  const scrollPositions = new Map()
</script>

<script>
  import { flattenDeep as _flattenDeep } from 'lodash-es'
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import { createDebouncer } from '../../utils'
  const slowDebounce = createDebouncer(1000)
  import { abbreviationTracker } from '../../libraries/emmet/plugin'

  import { highlightedElement } from '../../stores/app/misc'
  import { code as site_code } from '../../stores/data/site'
  import { code as page_code } from '../../stores/app/activePage'
  import { basicSetup } from 'codemirror'
  import { EditorView, keymap } from '@codemirror/view'
  import { standardKeymap, indentWithTab } from '@codemirror/commands'
  import { EditorState, Compartment } from '@codemirror/state'
  import { oneDarkTheme, ThemeHighlighting } from './theme'
  import {
    svelteCompletions,
    cssCompletions,
    extract_css_variables,
    updateCompletions,
  } from './extensions/autocomplete'
  import { getLanguage } from './extensions'
  import highlightActiveLine from './extensions/inspector'

  export let data = {}
  export let prefix = ''
  export let value = ''
  export let mode = 'html'
  export let style = ''
  export let debounce = false
  export let selection = 0
  export let docs = 'https://docs.primo.so/development'

  const dispatch = createEventDispatcher()

  const language = getLanguage(mode)

  const css_completions_compartment = new Compartment()
  let css_variables = extract_css_variables(
    $site_code.css + $page_code.css + value
  )

  var Editor
  const state = EditorState.create({
    selection: {
      anchor: selection,
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
          key: 'mod-1',
          run: () => {
            dispatch('tab-switch', 0)
            return true
          },
        },
        {
          key: 'mod-2',
          run: () => {
            dispatch('tab-switch', 1)
            return true
          },
        },
        {
          key: 'mod-3',
          run: () => {
            dispatch('tab-switch', 2)
            return true
          },
        },
        {
          key: 'mod-s',
          run: () => {
            dispatch('save')
            return true
          },
        },
        {
          key: 'mod-r',
          run: () => {
            dispatch('refresh')
            return true
          },
        },
        {
          key: 'mod-Enter',
          run: () => {
            const value = Editor.state.doc.toString()
            const position = Editor.state.selection.main.head
            formatCode(value, { mode, position }).then((res) => {
              if (!res) return
              const { formatted, cursorOffset } = res
              Editor.dispatch({
                changes: [
                  {
                    from: 0,
                    to: Editor.state.doc.length,
                    insert: formatted,
                  },
                ],
                selection: {
                  anchor: cursorOffset,
                },
              })
              dispatchChanges(formatted)
            })
            return true
          },
        },
      ]),
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
      ...(mode === 'css'
        ? [css_completions_compartment.of(cssCompletions(css_variables))]
        : []),
    ],
  })

  // re-configure css-variables autocomplete when variables change
  $: css_variables = extract_css_variables(
    $site_code.css + $page_code.css + value
  )
  $: mode === 'css' &&
    Editor &&
    Editor.dispatch({
      effects: css_completions_compartment.reconfigure(
        cssCompletions(css_variables)
      ),
    })

  $: mode === 'html' &&
    Editor &&
    highlightActiveLine(Editor, $highlightedElement)

  let prettier
  let css
  let babel
  let svelte
  if (!import.meta.env.SSR) fetchPrettier()

  async function fetchPrettier() {
    prettier = await import('prettier')
    css = (await import('prettier/esm/parser-postcss')).default
    babel = (await import('prettier/esm/parser-babel')).default
    svelte = (await import('../../libraries/prettier/prettier-svelte')).default
  }

  async function formatCode(code, { mode, position }) {
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
        plugins: [svelte, css, babel],
        // plugins: [svelte]
      })
    } catch (e) {
      console.warn(e)
    }
    return formatted
  }

  let editorNode
  $: if (editorNode) {
    Editor = new EditorView({
      state,
      parent: editorNode,
    })
  }

  function dispatchChanges(value) {
    dispatch('change', value)
  }

  let element
  $: if (element) {
    if (scrollPositions.has(value)) {
      element.scrollTo(0, scrollPositions.get(value))
    }
    element.addEventListener('scroll', () => {
      scrollPositions.set(value, element.scrollTop)
    })
  }
</script>

<svelte:window
  on:resize={() => {
    // Editor.setSize(null, editorNode.clientHeight)
  }}
/>

<div bind:this={element} class="codemirror-container {mode}" {style}>
  <div in:fade={{ duration: 200 }} bind:this={editorNode} />
  <a class="docs" target="blank" href={docs}>
    <span>Docs</span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
      />
      <path
        d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
      />
    </svg>
  </a>
</div>

<style lang="postcss">
  .codemirror-container {
    width: 100%;
    overflow-y: scroll;
    overscroll-behavior-x: contain; /* prevent from swiping back */
    font-family: 'Fira Code', monospace !important;
    height: calc(100% - 40px);
    position: relative;
  }

  .docs {
    position: sticky;
    bottom: 0.25rem;
    left: 100%;
    margin-right: 0.25rem;
    color: var(--color-gray-2);
    background: var(--color-gray-9);
    transition: 0.1s background;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    display: inline-flex;

    span {
      margin-right: 0.25rem;
    }

    svg {
      width: 0.75rem;
    }

    &:hover {
      background: var(--color-gray-8);
    }
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

  :global(
      .ͼo .cm-tooltip-autocomplete > ul > li[aria-selected='true'],
      .ͼo .cm-tooltip-autocomplete > ul > li:hover
    ) {
    color: white;
    background: var(--color-gray-7);
    transition: 0.1s background, 0.1s color;
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
