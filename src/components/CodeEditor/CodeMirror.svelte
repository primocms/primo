<script>
  import {onMount,onDestroy,createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'

  import CodeMirror from 'codemirror/lib/codemirror'
  
  const dispatch = createEventDispatcher()

  export let prefix = ''
  export let value = ''
  export let mode = {
    name: 'handlebars',
    base: 'text/html'
  }
  export let disabled = false
  export let style = ''
  export let CodeMirrorOptions = {}
  export let docs = null
  export let autofocus = false

  window.requestIdleCallback(async () => {
    value = await formatCode(value, mode)
  })

  async function formatCode(code, mode) {
    const {default:prettier} = await import('prettier')
    const plugin = await {
      'html': import('prettier/parser-html'),
      'css': import('prettier/parser-postcss'),
      'javascript': import('prettier/parser-babel')
    }[mode]

    let formatted = code
    try {
      formatted = prettier.format(value, { 
        parser: mode,  
        plugins: [plugin]
      })
    } catch(e) {
      console.warn(e)
    }
    return formatted
  }


  const languageMode = {
    'css' : 'text/x-scss',
    'html' : {
      name: 'handlebars',
      base: 'text/html'
    }
  }[mode] || mode

  var Editor

  async function importCodeMirrorAddons() {
    // CodeMirror = (await import('codemirror/lib/codemirror.js')).default
    await Promise.all([
      import('codemirror/mode/javascript/javascript.js'),
      import('codemirror/mode/handlebars/handlebars.js'),
      import('codemirror/mode/xml/xml.js'),
      import('codemirror/mode/css/css.js'),
      import('codemirror/addon/edit/closetag.js'),
      import('codemirror/addon/selection/active-line.js'),
      import('codemirror/addon/comment/comment.js'),
      import('codemirror/addon/fold/foldcode.js'),
      import('codemirror/addon/fold/xml-fold.js'),
      import('codemirror/keymap/sublime.js')
    ])

    const {default:emmet} = await import('@emmetio/codemirror-plugin')
    emmet(CodeMirror);

  }

  onMount(async () => {

    await importCodeMirrorAddons()

    Editor = CodeMirror(editorNode, {
      // passed values
      value: prefix + value,
      mode: languageMode,
      readOnly: disabled,
      ...CodeMirrorOptions,
      // set values
      autofocus,
      theme: 'vscode-dark',
      lineNumbers: true,
      gutter: true,
      indentUnit: 4,
      smartIndent: false,
      styleActiveLine: {nonEmpty: true},
      styleActiveSelected: true,
      keyMap: 'sublime',
      extraKeys: {
        'Tab': 'emmetExpandAbbreviation',
        'Esc': 'emmetResetAbbreviation',
        'Enter': 'emmetInsertLineBreak'
      },
      viewportMargin: Infinity,
      ... typeof languageMode === 'string' && languageMode.includes('css') ? {} : {
        emmet: {
          previewOpenTag: false
        },
      }, // don't run emmet on CSS (because it shows that ugly box)
      autoCloseTags: true
    });
    setTimeout(() => {Editor.refresh()}, 500) // needs this for some reason

    Editor.on('change', () => {
      const newValue = Editor.doc.getValue()
      value = newValue.replace(prefix, '')
      dispatch('change')
    })
    Editor.on("gutterClick", foldHTML);
    function foldHTML(cm, where) { cm.foldCode(where, CodeMirror.tagRangeFinder); }

    // set editor height (can't figure out how to set it without to not overflow the modal height)
    setTimeout(() => {
      if (editorNode) {
        editorNode.firstChild.classList.add('fadein')
      } 
    }, 100) // so the fade works
  })

  $: {
    if (Editor) {
      // make bind:value work from parent to child
      if ((prefix+value) !== Editor.doc.getValue()) {
        Editor.getDoc().setValue(prefix+value)
      }
      // make `disabled` dynamic
      Editor.setOption('readOnly', disabled)
    }
  } 

  let editorNode

</script>

<svelte:window 
  on:resize={() => {
    Editor.setSize(null, editorNode.clientHeight)
  }}
/>

<div class="codemirror-container" style="{style}">
  <div in:fade={{ duration: 200 }} bind:this={editorNode} style="min-height:100px"></div>
  {#if docs}
    <a target="blank" href="{docs}" class="z-10 text-xs pointer-events-auto flex items-center absolute bottom-0 right-0 h-auto text-gray-100 py-1 px-3 m-1 bg-gray-900 hover:bg-primored transition-colors duration-200">
      <i class="fas fa-external-link-alt mr-1"></i>
      <span>Docs</span>
    </a>
  {/if}
</div>

<style global>

  /* BASICS */

  .CodeMirror {
    /* Set height, width, borders, and global font properties here */
    font-family: monospace;
    color: black;
    direction: ltr;
    @apply h-auto w-full opacity-0 transition-opacity duration-100;

    &.fadein {
      @apply opacity-100;
    }
  }

  /* PADDING */

  .CodeMirror-lines {
    padding: 4px 0; /* Vertical padding around content */
  }
  .CodeMirror pre.CodeMirror-line,
  .CodeMirror pre.CodeMirror-line-like {
    padding: 0 4px; /* Horizontal padding of content */
  }

  .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler {
    background-color: white; /* The little square between H and V scrollbars */
  }

  /* GUTTER */

  .CodeMirror-gutters {
    border-right: 1px solid #ddd;
    background-color: #f7f7f7;
    white-space: nowrap;
  }
  .CodeMirror-linenumbers {}
  .CodeMirror-linenumber {
    padding: 0 3px 0 5px;
    min-width: 20px;
    text-align: right;
    color: #999;
    white-space: nowrap;
  }

  .CodeMirror-guttermarker { color: black; }
  .CodeMirror-guttermarker-subtle { color: #999; }

  /* CURSOR */

  .CodeMirror-cursor {
    border-left: 1px solid black;
    border-right: none;
    width: 0;
  }
  /* Shown when moving in bi-directional text */
  .CodeMirror div.CodeMirror-secondarycursor {
    border-left: 1px solid silver;
  }
  .cm-fat-cursor .CodeMirror-cursor {
    width: auto;
    border: 0 !important;
    background: #7e7;
  }
  .cm-fat-cursor div.CodeMirror-cursors {
    z-index: 1;
  }
  .cm-fat-cursor-mark {
    background-color: rgba(20, 255, 20, 0.5);
    -webkit-animation: blink 1.06s steps(1) infinite;
    -moz-animation: blink 1.06s steps(1) infinite;
    animation: blink 1.06s steps(1) infinite;
  }
  .cm-animate-fat-cursor {
    width: auto;
    border: 0;
    -webkit-animation: blink 1.06s steps(1) infinite;
    -moz-animation: blink 1.06s steps(1) infinite;
    animation: blink 1.06s steps(1) infinite;
    background-color: #7e7;
  }
  @-moz-keyframes blink {
    0% {}
    50% { background-color: transparent; }
    100% {}
  }
  @-webkit-keyframes blink {
    0% {}
    50% { background-color: transparent; }
    100% {}
  }
  @keyframes blink {
    0% {}
    50% { background-color: transparent; }
    100% {}
  }

  /* Can style cursor different in overwrite (non-insert) mode */
  .CodeMirror-overwrite .CodeMirror-cursor {}

  .cm-tab { display: inline-block; text-decoration: inherit; }

  .CodeMirror-rulers {
    position: absolute;
    left: 0; right: 0; top: -50px; bottom: 0;
    overflow: hidden;
  }
  .CodeMirror-ruler {
    border-left: 1px solid #ccc;
    top: 0; bottom: 0;
    position: absolute;
  }

  /* DEFAULT THEME */

  .cm-s-default .cm-header {color: blue;}
  .cm-s-default .cm-quote {color: #090;}
  .cm-negative {color: #d44;}
  .cm-positive {color: #292;}
  .cm-header, .cm-strong {font-weight: bold;}
  .cm-em {font-style: italic;}
  .cm-link {text-decoration: underline;}
  .cm-strikethrough {text-decoration: line-through;}

  .cm-s-default .cm-keyword {color: #708;}
  .cm-s-default .cm-atom {color: #219;}
  .cm-s-default .cm-number {color: #164;}
  .cm-s-default .cm-def {color: #00f;}
  .cm-s-default .cm-variable,
  .cm-s-default .cm-punctuation,
  .cm-s-default .cm-property,
  .cm-s-default .cm-operator {}
  .cm-s-default .cm-variable-2 {color: #05a;}
  .cm-s-default .cm-variable-3, .cm-s-default .cm-type {color: #085;}
  .cm-s-default .cm-comment {color: #a50;}
  .cm-s-default .cm-string {color: #a11;}
  .cm-s-default .cm-string-2 {color: #f50;}
  .cm-s-default .cm-meta {color: #555;}
  .cm-s-default .cm-qualifier {color: #555;}
  .cm-s-default .cm-builtin {color: #30a;}
  .cm-s-default .cm-bracket {color: #997;}
  .cm-s-default .cm-tag {color: #170;}
  .cm-s-default .cm-attribute {color: #00c;}
  .cm-s-default .cm-hr {color: #999;}
  .cm-s-default .cm-link {color: #00c;}

  .cm-s-default .cm-error {color: #f00;}
  .cm-invalidchar {color: #f00;}

  .CodeMirror-composing { border-bottom: 2px solid; }

  /* Default styles for common addons */

  div.CodeMirror span.CodeMirror-matchingbracket {color: #0b0;}
  div.CodeMirror span.CodeMirror-nonmatchingbracket {color: #a22;}
  .CodeMirror-matchingtag { background: rgba(255, 150, 0, .3); }
  .CodeMirror-activeline-background {background: #e8f2ff;}

  /* STOP */

  /* The rest of this file contains styles related to the mechanics of
    the editor. You probably shouldn't touch them. */

  .CodeMirror {
    position: relative;
    overflow: hidden;
    background: white;
  }

  .CodeMirror-scroll {
    overflow: scroll !important; /* Things will break if this is overridden */
    /* 50px is the magic margin used to hide the element's real scrollbars */
    /* See overflow: hidden in .CodeMirror */
    margin-bottom: -50px; margin-right: -50px;
    padding-bottom: 50px;
    height: 100%;
    outline: none; /* Prevent dragging from highlighting the element */
    position: relative;
  }
  .CodeMirror-sizer {
    position: relative;
    border-right: 50px solid transparent;
  }

  /* The fake, visible scrollbars. Used to force redraw during scrolling
    before actual scrolling happens, thus preventing shaking and
    flickering artifacts. */
  .CodeMirror-vscrollbar, .CodeMirror-hscrollbar, .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler {
    position: absolute;
    z-index: 6;
    display: none;
  }
  .CodeMirror-vscrollbar {
    right: 0; top: 0;
    overflow-x: hidden;
    overflow-y: scroll;
  }
  .CodeMirror-hscrollbar {
    bottom: 0; left: 0;
    overflow-y: hidden;
    overflow-x: scroll;
  }
  .CodeMirror-scrollbar-filler {
    right: 0; bottom: 0;
  }
  .CodeMirror-gutter-filler {
    left: 0; bottom: 0;
  }

  .CodeMirror-gutters {
    position: absolute; left: 0; top: 0;
    min-height: 100%;
    z-index: 3;
  }
  .CodeMirror-gutter {
    white-space: normal;
    height: 100%;
    display: inline-block;
    vertical-align: top;
    margin-bottom: -50px;
  }
  .CodeMirror-gutter-wrapper {
    position: absolute;
    z-index: 4;
    background: none !important;
    border: none !important;
  }
  .CodeMirror-gutter-background {
    position: absolute;
    top: 0; bottom: 0;
    z-index: 4;
  }
  .CodeMirror-gutter-elt {
    position: absolute;
    cursor: default;
    z-index: 4;
  }
  .CodeMirror-gutter-wrapper ::selection { background-color: transparent }
  .CodeMirror-gutter-wrapper ::-moz-selection { background-color: transparent }

  .CodeMirror-lines {
    cursor: text;
    min-height: 1px; /* prevents collapsing before first draw */
  }
  .CodeMirror pre.CodeMirror-line,
  .CodeMirror pre.CodeMirror-line-like {
    /* Reset some styles that the rest of the page might have set */
    -moz-border-radius: 0; -webkit-border-radius: 0; border-radius: 0;
    border-width: 0;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    margin: 0;
    white-space: pre;
    word-wrap: normal;
    line-height: inherit;
    color: inherit;
    z-index: 2;
    position: relative;
    overflow: visible;
    -webkit-tap-highlight-color: transparent;
    -webkit-font-variant-ligatures: contextual;
    font-variant-ligatures: contextual;
  }
  .CodeMirror-wrap pre.CodeMirror-line,
  .CodeMirror-wrap pre.CodeMirror-line-like {
    word-wrap: break-word;
    white-space: pre-wrap;
    word-break: normal;
  }

  .CodeMirror-linebackground {
    position: absolute;
    left: 0; right: 0; top: 0; bottom: 0;
    z-index: 0;
  }

  .CodeMirror-linewidget {
    position: relative;
    z-index: 2;
    padding: 0.1px; /* Force widget margins to stay inside of the container */
  }

  .CodeMirror-widget {}

  .CodeMirror-rtl pre { direction: rtl; }

  .CodeMirror-code {
    outline: none;
  }

  /* Force content-box sizing for the elements where we expect it */
  .CodeMirror-scroll,
  .CodeMirror-sizer,
  .CodeMirror-gutter,
  .CodeMirror-gutters,
  .CodeMirror-linenumber {
    -moz-box-sizing: content-box;
    box-sizing: content-box;
  }

  .CodeMirror-measure {
    position: absolute;
    width: 100%;
    height: 0;
    overflow: hidden;
    visibility: hidden;
  }

  .CodeMirror-cursor {
    position: absolute;
    pointer-events: none;
  }
  .CodeMirror-measure pre { position: static; }

  div.CodeMirror-cursors {
    visibility: hidden;
    position: relative;
    z-index: 3;
  }
  div.CodeMirror-dragcursors {
    visibility: visible;
  }

  .CodeMirror-focused div.CodeMirror-cursors {
    visibility: visible;
  }

  .CodeMirror-selected { background: #d9d9d9; }
  .CodeMirror-focused .CodeMirror-selected { background: #d7d4f0; }
  .CodeMirror-crosshair { cursor: crosshair; }
  .CodeMirror-line::selection, .CodeMirror-line > span::selection, .CodeMirror-line > span > span::selection { background: #d7d4f0; }
  .CodeMirror-line::-moz-selection, .CodeMirror-line > span::-moz-selection, .CodeMirror-line > span > span::-moz-selection { background: #d7d4f0; }

  .cm-searching {
    background-color: #ffa;
    background-color: rgba(255, 255, 0, .4);
  }

  /* Used to force a border model for a node */
  .cm-force-border { padding-right: .1px; }

  @media print {
    /* Hide the cursor when printing */
    .CodeMirror div.CodeMirror-cursors {
      visibility: hidden;
    }
  }

  /* See issue #2901 */
  .cm-tab-wrap-hack:after { content: ''; }

  /* Help users use markselection to safely style text background */
  span.CodeMirror-selectedtext { background: none; }


  .codemirror-container {
    @apply relative flex w-full flex-1 bg-codeblack;
  }
  .codemirror-container > div {
    @apply flex flex-1 w-full;
  }
  .CodeMirror {
    font-size: 16px;
    font-family: -apple-system,BlinkMacSystemFont,Segoe WPC,Segoe UI,HelveticaNeue-Light,Ubuntu,Droid Sans,sans-serif !important;
  }

  /* VSCode Theme */
  .cm-s-vscode-dark span.cm-meta {color: #569cd6}
  .cm-s-vscode-dark span.cm-number {color: #b5cea8}
  .cm-s-vscode-dark span.cm-keyword {line-height: 1em; font-weight: bold; color: #569cd6;}
  .cm-s-vscode-dark span.cm-def {color:#9cdcfe}
  .cm-s-vscode-dark span.cm-variable {color: #ddd6a3}
  .cm-s-vscode-dark span.cm-variable-2 {color: #9cdcfe}
  .cm-s-vscode-dark span.cm-variable-3,
  .cm-s-vscode-dark span.cm-type {color: #A9B7C6}
  .cm-s-vscode-dark span.cm-property {color: #9cdcfe}
  .cm-s-vscode-dark span.cm-operator {color: #d4d4d4}
  .cm-s-vscode-dark span.cm-string {color: #ce9178}
  .cm-s-vscode-dark span.cm-string-2 {color: #6A8759}
  .cm-s-vscode-dark span.cm-comment {color: #6A9955}
  .cm-s-vscode-dark span.cm-link {color: #287BDE}
  .cm-s-vscode-dark span.cm-atom {color: #569cd6}
  .cm-s-vscode-dark span.cm-error {color: #BC3F3C}
  .cm-s-vscode-dark span.cm-tag {color: #569cd6}
  .cm-s-vscode-dark span.cm-attribute {color: #9cdcfe}
  .cm-s-vscode-dark span.cm-qualifier {color: #d7ba7d}
  .cm-s-vscode-dark span.cm-bracket {color: #808080}

  .cm-s-vscode-dark.CodeMirror {background: #1e1e1e; color: #e9e9e9;}
  .cm-s-vscode-dark .CodeMirror-cursor {border-left: 1px solid #bebebe;}
  .CodeMirror-activeline-background {background: #3A3A3A;}
  .cm-s-vscode-dark div.CodeMirror-selected {background: #1e496c}
  .cm-s-vscode-dark .CodeMirror-gutters {background: #252526; border-right: 1px solid grey; color: #606366}
  .cm-s-vscode-dark span.cm-builtin {color: #A9B7C6;}
  .cm-s-vscode-dark {font-family: Consolas, 'Courier New', monospace, serif;}
  .cm-s-vscode-dark .CodeMirror-matchingbracket {background-color: #3b514d; color: yellow !important;}

  .CodeMirror-hints.vscode-dark {
    font-family: Consolas, 'Courier New', monospace;
    color: #9c9e9e;
    background-color: #3b3e3f !important;
  }

  .CodeMirror-hints.vscode-dark .CodeMirror-hint-active {
    background-color: #494d4e !important;
    color: #9c9e9e !important;
  }

  /* Overrides */
  .cm-s-vscode-dark .CodeMirror-gutters {
    border-color: transparent;
  }

  .CodeMirror-activeline-background {
    background-color: #222 !important;
  }

  .emmet-abbreviation-preview {
    z-index: 9;
    @apply bg-gray-900;
    .CodeMirror {
      @apply shadow-lg bg-gray-900;
    }
  }

  /* Pretty 'see more' button */
  .CodeMirror-foldmarker {
    @apply cursor-pointer rounded-full bg-primored text-white transition-colors duration-200;
    padding: 4px 6px;
    animation: fadein 0.2s;
    &:hover {
      @apply bg-gray-700;
    }
  }

  @keyframes fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* hover effect for code folding */

  .CodeMirror-linenumber.CodeMirror-gutter-elt {
    will-change: background, background-color;
    @apply bg-codeblack transition-colors duration-100 cursor-pointer;
    &:hover {
      @apply bg-primored text-white;
    }
  }

  .emmet-abbreviation-preview-error {
    @apply hidden;
  }

</style>