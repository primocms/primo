<script>
  import _ from 'lodash';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import Mousetrap from 'mousetrap';
  import { formatCode } from '../../utilities';
  import { createDebouncer } from '../../utils';
  const slowDebounce = createDebouncer(500);

  import { keymap } from '@codemirror/view';
  import { basicSetup, EditorView } from '@codemirror/basic-setup';
  import { defaultTabBinding } from '@codemirror/commands';
  import { EditorState, Compartment } from '@codemirror/state';
  import MainTheme from './theme';
  import emmetExt from './emmet-codemirror';
  import extensions, { getLanguage } from './extensions';
  // import cssPeek from './css-peek';

  import 'requestidlecallback-polyfill';

  const languageConf = new Compartment();
  const tabSize = new Compartment();

  const dispatch = createEventDispatcher();

  export let prefix = '';
  export let value = '';
  export let mode = 'html';
  export let disabled = false;
  export let style = '';
  export let autofocus;
  export let debounce = false;
  export let selection = 0;

  const language = getLanguage(mode);
  function getEmmetConfig(type) {
    switch (type) {
      case 'css':
        return {
          type: 'stylesheet',
          syntax: 'css',
        };
      case 'html':
        return {
          type: 'markup',
          syntax: 'html',
        };
      default:
        throw `Invalid type: ${type}. Expected 'stylesheet' or 'markup'`;
    }
  }

  var Editor;
  const state = EditorState.create({
    selection: {
      anchor: selection,
    },
    doc: prefix + value,
    extensions: [
      extensions,
      languageConf.of(language),
      // mode !== 'javascript' ? emmetExt({
      //   theme: {
      //     padding: '0.5rem',
      //     background: '#111',
      //     boxShadow: `0 0 #0000, 0 0 #0000, 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`
      //   },
      //   config: getEmmetConfig(mode)
      // }) : [],
      keymap.of([
        defaultTabBinding,
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
            formatCode(value, mode).then((formatted) => {
              Editor.dispatch({
                changes: [
                  { from: 0, to: Editor.state.doc.length, insert: formatted },
                ],
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
            dispatch('debounce', value);
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
  }} />

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
    font-family: 'Fira Code', serif;
    height: calc(100vh - 9.5rem);

    & > div {
      min-height: 100px;
    }
  }

</style>
