<script lang="ts">
  import {some, flattenDeep as _flattenDeep} from 'lodash-es';
  import {autocompletion} from '@codemirror/autocomplete'
  import '@fontsource/fira-code/index.css';
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/env';
  import { fade } from 'svelte/transition';
  import { createDebouncer } from '../../utils';
  const slowDebounce = createDebouncer(500);
  import { abbreviationTracker } from '../../libraries/emmet/plugin';

  import {highlightedElement} from '../../stores/app/misc';
  import { EditorView, keymap } from '@codemirror/view';
  import { standardKeymap, indentWithTab } from '@codemirror/commands';
  import { EditorState, Compartment } from '@codemirror/state';
  import MainTheme from './theme';
  import extensions, { getLanguage } from './extensions';
  import highlightActiveLine from './extensions/inspector'
  import svelteSyntax from './extensions/svelte'

  const languageConf = new Compartment();
  const tabSize = new Compartment();

  const dispatch = createEventDispatcher();

  export let prefix = '';
  export let value = '';
  export let mode = 'html';
  export let style = '';
  export let debounce = false;
  export let selection = 0;


  const language = getLanguage(mode);

  var Editor;
  const state = EditorState.create({
    selection: {
      anchor: selection,
    },
    doc: prefix + value,
    extensions: [
      abbreviationTracker(),
      svelteSyntax(),
      autocompletion(),
      languageConf.of(language),
      keymap.of([
        standardKeymap,
        indentWithTab,
        {
          key: 'mod-1',
          run: () => {
            dispatch('tab-switch', 0);
            return true;
          },
        },
        {
          key: 'mod-2',
          run: () => {
            dispatch('tab-switch', 1);
            return true;
          },
        },
        {
          key: 'mod-3',
          run: () => {
            dispatch('tab-switch', 2);
            return true;
          },
        },
        {
          key: 'mod-s',
          run: () => {
            dispatch('save');
            return true;
          },
        },
        {
          key: 'mod-Enter',
          run: () => {
            const value = Editor.state.doc.toString();
            const position = Editor.state.selection.main.head;
            formatCode(value, { mode, position }).then((res) => {
              if (!res) return;
              const { formatted, cursorOffset } = res;
              Editor.dispatch({
                changes: [
                  { from: 0, to: Editor.state.doc.length, insert: formatted },
                ],
                selection: {
                  anchor: cursorOffset,
                },
              });
              dispatchChanges(formatted);
            });
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((view) => {
        if (view.docChanged) {
          const newValue = view.state.doc.toString();
          value = newValue.replace(prefix, '');
          if (debounce) {
            slowDebounce([dispatchChanges, value]);
          } else {
            dispatchChanges(value);
          }
        }
        selection = view.state.selection.main.from;
      }),
      MainTheme,
      tabSize.of(EditorState.tabSize.of(2)),
      ...extensions,
    ],
  });

  let prettier;
  let css;
  let babel;
  let svelte;
  if (browser) fetchPrettier();

  async function fetchPrettier() {
    prettier = await import('prettier');
    css = (await import('prettier/esm/parser-postcss')).default;
    babel = (await import('prettier/esm/parser-babel')).default;
    svelte = (await import('prettier-plugin-svelte'));
  }

  async function formatCode(code, { mode, position }) {
    let formatted;
    try {
      if (mode === 'javascript') {
        mode = 'babel';
      } else if (mode === 'html') {
        mode = 'svelte'
      }

      formatted = prettier.formatWithCursor(code, {
        parser: mode,
        bracketSameLine: true,
        cursorOffset: position,
        plugins: [svelte, css, babel],
        // plugins: [svelte]
      });
    } catch (e) {
      console.warn(e);
    }
    return formatted;
  }

  let editorMounted = false
  onMount(async () => {
    Editor = new EditorView({
      state,
      parent: editorNode,
    });
    editorMounted = true
  });

  let editorNode;

  function dispatchChanges(value) {
    dispatch('change', value);
  }

  let element;

  $: (mode === 'html' && Editor) && highlightActiveLine(Editor, $highlightedElement)

</script>

<svelte:window
  on:resize={() => {
    // Editor.setSize(null, editorNode.clientHeight)
  }}
/>

<div bind:this={element} class="codemirror-container {mode}" {style}>
  <div in:fade={{ duration: 200 }} bind:this={editorNode} />
</div>

<!-- {#if docs}
  <a target="blank" href="{docs}" class="z-10 text-xs pointer-events-auto flex items-center absolute bottom-0 right-0 h-auto text-gray-100 py-1 px-3 m-1 bg-gray-900 hover:bg-primored transition-colors duration-200">
    <i class="fas fa-external-link-alt mr-1"></i>
    <span>Docs</span>
  </a>
{/if} -->
<style lang="postcss">
  .codemirror-container {
    width: 100%;
    overflow-y: scroll;
    font-family: 'Fira Code', monospace !important;
    height: calc(100vh - 9.5rem);
  }

  :global(.highlighted) {
    background: var(--color-gray-6);
    /* color: white; */
    border-radius: 2px;
  }

  /* Ensure emmet popup doesn't get cut off */
  :global(.cm-scroller) {
    overflow: visible !important;
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
