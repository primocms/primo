<script>
  import {autocompletion} from '@codemirror/autocomplete'
  import '@fontsource/fira-code/index.css';
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/env';
  import { fade } from 'svelte/transition';
  import { createDebouncer } from '../../utils';
  const slowDebounce = createDebouncer(500);

  import { EditorView, keymap } from '@codemirror/view';
  import { standardKeymap, indentWithTab } from '@codemirror/commands';
  import { EditorState, Compartment } from '@codemirror/state';
  import MainTheme from './theme';
  import extensions, { getLanguage } from './extensions';

  const languageConf = new Compartment();
  const tabSize = new Compartment();

  const dispatch = createEventDispatcher();

  export let prefix = '';
  export let value = '';
  export let mode = 'html';
  export let style = '';
  export let autofocus;
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
      ...extensions,
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
    ],
  });

  let prettier;
  let html;
  let css;
  let babel;
  if (browser) fetchPrettier();

  async function fetchPrettier() {
    prettier = await import('prettier');
    html = (await import('prettier/esm/parser-html')).default;
    css = (await import('prettier/esm/parser-postcss')).default;
    babel = (await import('prettier/esm/parser-babel')).default;
  }

  async function formatCode(code, { mode, position }) {
    let formatted;
    try {
      if (mode === 'javascript') {
        mode = 'babel';
      }

      formatted = prettier.formatWithCursor(code, {
        parser: mode,
        bracketSameLine: true,
        cursorOffset: position,
        plugins: [html, css, babel],
      });
    } catch (e) {
      console.warn(e);
    }
    return formatted;
  }

  onMount(async () => {
    Editor = new EditorView({
      state,
      parent: editorNode,
    });

    if (autofocus) {
      Editor.focus();
    }
  });

  let editorNode;

  function dispatchChanges(value) {
    dispatch('change', value);
  }

  let element;
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
    overflow-x: scroll;
    font-family: 'Fira Code', 'Courier New', sans-serif !important;
    height: calc(100vh - 9.5rem);
  }
</style>
