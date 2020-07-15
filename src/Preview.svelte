<script>
  import { onMount, onDestroy } from 'svelte'
  import _ from 'lodash'
  import { fade } from 'svelte/transition'
  import {WebDeveloper} from '@svg';
  import {wrapInStyleTags} from 'utils'
  import {getHeadStyles,getPageLibraries,setHeadScript,setPageJsLibraries,appendHtml,setCustomScripts} from './screens/Page/pageUtils.js'
  import store from '@libraries/store.js'

  let tailwindStyles = store.get('tailwind')

  const { dependencies, settings, id, html, css, js } = store.get('preview')

  let componentId = id || null
  let previewHTML = html
  let previewCSS = wrapInStyleTags(css)

  let globalStyles = settings ? wrapInStyleTags(settings.globalStyles.compiled) : ''
  let headEmbed = dependencies ? dependencies.headEmbed : ''
  let cssLibraries = dependencies ? dependencies.libraries.filter(l => l.type === 'css') : []
  let jsLibraries = dependencies ? dependencies.libraries.filter(l => l.type === 'js') : []

  onMount(() => {
    setPageJs(js)
  })

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

</script>

<svelte:head>
  {@html headEmbed}
  {@html getPageLibraries(cssLibraries)}
  {#each cssLibraries as library}
    <link href="${library.src}" rel="stylesheet" />
  {/each}
  {@html globalStyles}
  {#if jsLibraries.length > 0}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.1/system.min.js" integrity="sha256-15j2fw0zp8UuYXmubFHW7ScK/xr5NhxkxmJcp7T3Lrc=" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/named-register.min.js" integrity="sha256-ezV7DuHnj9ggFddRE32dDuLSGesXoT2ZWY8g+mEknMM=" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/use-default.min.js" integrity="sha256-uVDULWwA/sIHxnO31dK8ThAuK46MrPmrVn+JXlMXc5A=" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/amd.min.js" integrity="sha256-7vS4pPsg7zx1oTAJ1zQIr2lDg/q8anzUCcz6nxuaKhU=" crossorigin="anonymous"></script>
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