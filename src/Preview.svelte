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

  async function setPageJs(js) {
    appendHtml(
      `[primo-js]`, 
      'script', 
      js,
      {
        type: 'module'
      }
    )
  }

  onMount(() => {
    setPageJs(js)
  })

</script>

<svelte:head>
  <link href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css" rel="stylesheet" type="text/css">
  {@html getPageLibraries(cssLibraries)}
  {#each cssLibraries as library}
    <link href="${library.src}" rel="stylesheet" />
  {/each}
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