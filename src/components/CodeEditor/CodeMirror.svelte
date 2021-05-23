<script>
  import _ from 'lodash'
  import {onMount,onDestroy,createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  import Mousetrap from 'mousetrap'
  import { formatCode } from '../../utilities'
  import {createDebouncer} from '../../utils'
  const slowDebounce = createDebouncer(500)

  import {keymap} from "@codemirror/view"
  import {basicSetup, EditorView} from "@codemirror/basic-setup"
  import {defaultTabBinding} from "@codemirror/commands"
  import {bracketMatching} from '@codemirror/matchbrackets'
  import {closeBrackets} from '@codemirror/closebrackets'
  import {EditorState,Compartment} from "@codemirror/state"
  import {html} from "@codemirror/lang-html"
  import {css} from "@codemirror/lang-css"
  import {javascript} from "@codemirror/lang-javascript"
  import MainTheme from './theme'

  import 'requestidlecallback-polyfill';

  const languageConf = new Compartment
  const tabSize = new Compartment

  const dispatch = createEventDispatcher()

  export let prefix = ''
  export let value = ''
  export let mode = 'html'
  export let disabled = false
  export let style = ''
  export let docs
  export let autofocus
  export let debounce
  export let selection = 0

  const language = {
    'html': html(),
    'css': css(),
    'javascript': javascript()
  }[mode]

  var Editor
  const state = EditorState.create({
    selection: {
      anchor: selection
    },
    doc: prefix + value,
    extensions: [
      basicSetup,
      languageConf.of(language),
      bracketMatching(),
      closeBrackets(),
      keymap.of([
        defaultTabBinding,
        { 
          key: "mod-1", 
          run: () => {
            dispatch('tab-switch', 0)
            return true
          }
        },
        { 
          key: "mod-2", 
          run: () => {
            dispatch('tab-switch', 1)
            return true
          }
        },
        { 
          key: "mod-3", 
          run: () => {
            dispatch('tab-switch', 2)
            return true
          }
        },
        { 
          key: "mod-s", 
          run: () => {
            dispatch('save')
            return true
          }
        },
        {
          key: "mod-Enter", 
          run: () => {
            const value = Editor.state.doc.toString()
            formatCode(value, mode).then(formatted => {
              Editor.dispatch({
                changes: [{from: 0, to: Editor.state.doc.length, insert: formatted}]
              })
              dispatchChanges(formatted)
            })
            return true
          }
        }
      ]),
      EditorView.updateListener.of((view) => {
        if (view.docChanged) {
          const newValue = view.state.doc.toString()
          value = newValue.replace(prefix, '')
          if (debounce) {
            dispatch('debounce', value)
            slowDebounce([ dispatchChanges, value ])
          } else {
            dispatchChanges(value)
          }
        }
        selection = view.state.selection.main.from
      }),
      MainTheme,
      tabSize.of(EditorState.tabSize.of(2))
    ]
  })

  onMount(async () => {    
    
    Editor = new EditorView({
      state,
      parent: editorNode
    })

    if (autofocus) {
      Editor.focus()
    } 
  })

  let editorNode

  function dispatchChanges(value) {
    dispatch('change', value) 
  }

</script>

<svelte:window 
  on:resize={() => {
    Editor.setSize(null, editorNode.clientHeight)
  }}
/>

<div class="codemirror-container {mode}" style="{style}">
  <div in:fade={{ duration: 200 }} bind:this={editorNode} style="min-height:100px"></div>
</div>
<!-- {#if docs}
  <a target="blank" href="{docs}" class="z-10 text-xs pointer-events-auto flex items-center absolute bottom-0 right-0 h-auto text-gray-100 py-1 px-3 m-1 bg-gray-900 hover:bg-primored transition-colors duration-200">
    <i class="fas fa-external-link-alt mr-1"></i>
    <span>Docs</span>
  </a>
{/if} -->

<style>

  @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');

  .codemirror-container {
    @apply w-full overflow-x-scroll;
  }

</style>