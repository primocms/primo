<script>
  import { onMount, onDestroy } from 'svelte'
  import _ from 'lodash'
  import { fade } from 'svelte/transition'
  import {WebDeveloper} from './components/svg';
  import {wrapInStyleTags} from './utils'
  import {getHeadStyles,getPageLibraries,setHeadScript,setPageJsLibraries,appendHtml,setCustomScripts} from './views/editor/pageUtils.js'
  import store from './libraries/store.js'

  let tailwindStyles = store.get('tailwind')

  const { dependencies, id, html, css, js } = store.get('preview')

  let componentId = id || null
  let previewHTML = html
  let previewCSS = wrapInStyleTags(css)

  let cssLibraries = dependencies ? dependencies.libraries.filter(l => l.type === 'css') : []
  let jsLibraries = dependencies ? dependencies.libraries.filter(l => l.type === 'js') : []

  store.on('preview', ({ newValue:value }) => {
    previewHTML = value.html
    previewCSS = wrapInStyleTags(value.css)
  })

  store.on('tailwind', ({ newValue:tailwind }) => {
    tailwindStyles = tailwind
  })
  
  $: importMap = JSON.stringify({
    "imports": _.mapValues(_.keyBy(jsLibraries, 'name'), 'src')
  })
  
  let systemJsNode
  $: {
    if (systemJsNode) {
      systemJsNode.innerHTML = importMap
    }
  }

  async function setPageJs(js) {
    const libraryNames = jsLibraries.map(l => l.name)
    const systemJsLibraries = libraryNames.map(name => `System.import('${name}')`).join(',')
    appendHtml(
      `[primo-js]`, 
      'script', 
      jsLibraries.length > 0 ? `Promise.all([${systemJsLibraries}]).then(modules => {
        const [${libraryNames.join(',')}] = modules;
        ${js}
      })` : js,
      {
        type: 'module'
      }
    )
  }

  if (jsLibraries.length > 0) {
    (async () => {
      await import('./libraries/systemjs/system.min.js')
      await import('./libraries/systemjs/named-register.min.js')
      await import('./libraries/systemjs/use-default.min.js')
      await import('./libraries/systemjs/amd.min.js')
      setPageJs(js)
    })()
  }

</script>

<svelte:head>
  <link href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css" rel="stylesheet" type="text/css">
  {@html getPageLibraries(cssLibraries)}
  {#each cssLibraries as library}
    <link href="${library.src}" rel="stylesheet" />
  {/each}
  {#if jsLibraries.length > 0 }
    <script type="systemjs-importmap" bind:this={systemJsNode}></script>
  {/if}
  {@html wrapInStyleTags(tailwindStyles)}
  {@html previewCSS}
</svelte:head>

{#if previewHTML}
  <div class="primo-page" in:fade={{ duration: 100 }} id="component-{componentId}">
    {@html previewHTML}
  </div>
{:else}
  <div id="primo-empty-state" in:fade={{ duration: 100 }}></div>
{/if}
<div primo-js></div>

<style global>

  .primo-page {
    @apply w-full h-full;
  }
  
  #primo-empty-state {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    padding: 4rem;
    box-sizing: border-box;
  }

</style>