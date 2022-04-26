<script lang="ts">
  import {some, flattenDeep as _flattenDeep} from 'lodash-es';
  import {autocompletion} from '@codemirror/autocomplete'
  import '@fontsource/fira-code/index.css';
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/env';
  import { fade } from 'svelte/transition';
  import { createDebouncer } from '../../utils';
  const slowDebounce = createDebouncer(500);

  import {highlightedElement} from '../../stores/app/misc';
  import { EditorView, keymap, Decoration, WidgetType, ViewUpdate, ViewPlugin, DecorationSet } from '@codemirror/view';
  import { standardKeymap, indentWithTab } from '@codemirror/commands';
  import {RangeSetBuilder} from "@codemirror/rangeset"
  import {syntaxTree} from "@codemirror/language"
  import { EditorState, Compartment, StateEffect, StateField, Facet, Extension } from '@codemirror/state';
  import MainTheme from './theme';
  import extensions, { getLanguage } from './extensions';

  const showStripes = ViewPlugin.fromClass(class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = stripeDeco(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = stripeDeco(update.view)
    }
  }, {
    decorations: v => v.decorations
  })


  const baseTheme = EditorView.baseTheme({
    ".cm-svelte-keyword": {
      color: 'rgb(197,134,192)'
    },
    ".cm-svelte-bracket, .cm-svelte-bracket *": {
      color: 'rgb(212,212,212) !important'
    },
    ".cm-svelte-variable, .cm-svelte-variable *": {
      color: 'rgb(156,218,252) !important'
    },
  })

const stepSize = Facet.define<number, number>({
  combine: values => values.length ? Math.min(...values) : 2
})

function zebraStripes(options: {step?: number} = {}): Extension {
  return [
    baseTheme,
    options.step == null ? [] : stepSize.of(options.step),
    showStripes
  ]
}

const highlightEntities = {
  bracket: Decoration.mark({class: "cm-svelte-bracket"}),
  variable: Decoration.mark({class: "cm-svelte-variable"}),
  keyword: Decoration.mark({class: "cm-svelte-keyword"}),
}

function stripeDeco(view: EditorView) {
  let builder = new RangeSetBuilder<Decoration>()
  const actions = []

  syntaxTree(view.state).iterate({
    from: view.visibleRanges['from'], 
    to: view.visibleRanges['to'],
    enter: (type, from, to) => {
      // highlight attributes when svelte variable
      if (type.name === 'Text' && mode === 'html') {
        const string = view.state.doc.sliceString(from, to)

        const [stringWithBrackets] = string.match(/({.*})/g) || [];
        if (stringWithBrackets) {
          const individualWords = stringWithBrackets.split(' ')

          individualWords.forEach((word) => {

            let position = from + string.indexOf(word, 0)

            const specialCharacters = ['{', '}']

            specialCharacters.forEach(highlightSpecialChar)

            function highlightSpecialChar(character, i) {
              const regex = new RegExp(character, 'g');
              const characterPosition = [...word.matchAll(regex)] // word.indexOf(character)
              if (characterPosition) {
                characterPosition.forEach(({ index }) => {
                  actions.push({
                    start: position + index, 
                    length: 1,
                    mark: highlightEntities.bracket,
                    string: character
                  })
                })
              }
            }

            const keywords = ['#each', '/each', 'as', '@html', '/if', '#if', ':else']

            keywords.forEach(highlightKeyword)

            function highlightKeyword(keyword) {
              const keywordPosition = word.indexOf(keyword)

              if (keywordPosition === -1) return

              actions.push({
                start: position + keywordPosition, 
                length: keyword.length, 
                mark: highlightEntities.keyword,
                string: keyword
              })
            }

            const [enclosedVariable] = word.match(/({.*})/g) || []

            if (enclosedVariable) {
              const variable = enclosedVariable.replace(/[{}]/g, "")

              if (keywords.includes(variable)) return

              const newPosition = from + string.indexOf(variable)

              actions.push({
                start: newPosition, 
                end: newPosition + variable.length, 
                mark: highlightEntities.variable
              })
            } else if (word.match(/([{}])/g)) {
              const variable = word.replace(/[{}]/g, "")
              if (keywords.includes(variable)) return

              const newPosition = from + string.indexOf(word)

              actions.push({
                start: newPosition, 
                end: newPosition + variable.length, 
                mark: highlightEntities.variable
              })
            } else {
              const isKeyword = some(keywords, keyword => word.includes(keyword), false)
              if (isKeyword) return
              
              const newPosition = from + string.indexOf(word)
              actions.push({
                start: newPosition, 
                end: newPosition + word.length, 
                mark: highlightEntities.variable
              })
            }
          
          })
        }

      } else if (type.name === 'UnquotedAttributeValue') {
        const string = view.state.doc.sliceString(from, to)
        actions.push({
          start: from, 
          end: from + 1, 
          mark: highlightEntities.bracket
        })
        actions.push({
          start: from + 1, 
          end: from + string.length - 1, 
          mark: highlightEntities.variable
        })
        actions.push({
          start: from + string.length -1, 
          end: from + string.length, 
          mark: highlightEntities.bracket
        })
      }
    }
  })

  const sorted = actions.sort((a, b) => a.start - b.start)

  sorted.forEach(({start, end, length, mark}) => {
    builder.add(start, length ? (start + length) : end, mark)
  })
  return builder.finish()
}


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
      zebraStripes({step: 2}),
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

  $: editorNode && highlightTags($highlightedElement)
  function highlightTags(element) {
    if (!element) return
    const withoutBody = element.slice(7)
    const selectors = withoutBody.split(' > ')
    const found = editorNode.querySelectorAll('span.ͼu');
    const tags = Array.from(found).map((node, index) => ({ index, node })).filter(({node}) => selectors.includes(node.innerText));
    console.log({selectors, found, withoutBody, tags})
    found.forEach(tag => {
      tag.classList.remove('highlighted')
    })
    tags.forEach(({node}) => {
      node.classList.add('highlighted')
    })
  }

  function foo(node) {
    console.log({node})

    setTimeout(() => {
      const child = node.querySelector('.cm-content')
      const found = child.querySelector('span.ͼu') || {}
      const {innerText} = found
      console.log({child, found, innerText})
    }, 2000)
    // get node children

    // select `.cm-line .cu`, on hover get content of cm-line

    // look for content in preview
  }

  $: if (editorNode && editorMounted && mode === 'html') {
    const children = Array.from(editorNode.querySelectorAll('.cm-line'))
    children.forEach(node => {
      node.addEventListener('mouseenter', () => {
        const content = node.querySelector('.ͼu')
        const text = content.textContent
        const html = content.innerHTML
        console.log({text, html})
        dispatch('tag-select', html)
      })
    })
    const asTags = children.map(n => n.innerHTML)
    console.log({children, asTags})
  }

</script>

<svelte:window
  on:resize={() => {
    // Editor.setSize(null, editorNode.clientHeight)
  }}
/>

<div use:foo bind:this={element} class="codemirror-container {mode}" {style}>
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
    font-family: 'Fira Code', monospace !important;
    height: calc(100vh - 9.5rem);
  }

  :global(.highlighted) {
    background: var(--color-gray-6);
    /* color: white; */
    border-radius: 2px;
  }
</style>
