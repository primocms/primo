<script lang="ts">
  import _ from 'lodash'
  import {onMount,setContext,createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  import Editor from './Editor.svelte'
  import View from './View.svelte'
  import {Button} from '../../components/buttons'
  import {getHeadStyles, setCustomScripts, setHeadScript, getPageLibraries, setPageJsLibraries} from './pageUtils.js'
  import {FeedbackForm,Spinner} from '../../components/misc'
  import { parseHandlebars, convertFieldsToData, ax, wrapInStyleTags } from '../../utils'

  import {dependencies,domainInfo,user} from '../../stores/data'
  import tailwind, {loadingTailwind} from '../../stores/data/tailwind'
  import site from '../../stores/data/site'
  import pageDataStore from '../../stores/data/pageData'
  import {pageId as pageIdStore} from '../../stores/data/page'
  import content from '../../stores/data/page/content'
  import modal from '../../stores/app/modal'
  import {DEFAULTS} from '../../const'

  const dispatch = createEventDispatcher()

  setContext('editable', true)

  export let pageId : string
  $: pageId = pageId === 'index.html' ? 'index' : pageId // pageId has .html on desktop
	$: pageIdStore.set(pageId) 

  let siteStyles:string 
  $: siteStyles = wrapInStyleTags($site.styles.final, 'site-styles')

  let pageStyles:string 
  $: pageStyles = wrapInStyleTags($pageDataStore.styles.final, 'page-styles')

  let libraries:Array<any>
  $: libraries = $pageDataStore.dependencies.libraries

  let customScripts:Array<any> = []

  let firestoreLoaded:boolean = false

  let cssLibraries:Array<any>
  $: cssLibraries = libraries.filter(l => l.type === 'css')

  let jsLibraries:Array<any>
  $: jsLibraries = libraries.filter(l => l.type === 'js')

  function unlockPage() {
    user.set({canEditPage: true})
  }

  function containsField(row, fieldType) {
    return _.some(row.value.raw.fields, ['type', fieldType])
  }

  // This is how we use SystemJS to get modules working inside components
  let importMap:string
  $: importMap = JSON.stringify({
    "imports": _.mapValues(_.keyBy(libraries.filter(l => l.src.slice(-5).includes('.js')), 'name'), 'src')
  })
  
  let systemJsNode
  $: {
    if (systemJsNode) {
      systemJsNode.innerHTML = importMap
    }
  }

</script>

<svelte:head>
  {@html $pageDataStore.wrapper.head.final}
  <link href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css" rel="stylesheet">
  {@html wrapInStyleTags($tailwind, 'tailwind')}
  {@html siteStyles}
  {@html pageStyles}

  {#each customScripts as {src}}
    <script {src}></script>
  {/each}

  {#each cssLibraries as library}
    <link href="${library.src}" rel="stylesheet" />
  {/each}
  {#if jsLibraries.length > 0}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.1/system.min.js" integrity="sha256-15j2fw0zp8UuYXmubFHW7ScK/xr5NhxkxmJcp7T3Lrc=" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/named-register.min.js" integrity="sha256-ezV7DuHnj9ggFddRE32dDuLSGesXoT2ZWY8g+mEknMM=" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/use-default.min.js" integrity="sha256-uVDULWwA/sIHxnO31dK8ThAuK46MrPmrVn+JXlMXc5A=" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/amd.min.js" integrity="sha256-7vS4pPsg7zx1oTAJ1zQIr2lDg/q8anzUCcz6nxuaKhU=" crossorigin="anonymous"></script>
    <script type="systemjs-importmap" bind:this={systemJsNode}></script>
  {/if}
</svelte:head>

<Editor 
  on:change
  on:save
  on:build
  on:signOut
/>


<!-- {#if $loadingTailwind}
  <div class="flex" id="loading" transition:fade={{ duration: 200 }}>
    <span class="text-white text-xs mr-2">Loading Tailwind styles</span>
    <Spinner variants="text-white" size="xs"/>
  </div>
{/if} -->

<style>

  #loading {
    @apply fixed font-medium rounded-full bg-primored py-1 px-3 shadow-lg;
    left: 0.5rem;
    bottom: 0.5rem;
    z-index: 99999999999;
  }

  #primo-symbol {
    width: 3rem;
    height: 2rem;
  }

  /* remove random annoying Monaco alert that sometimes shows up at the bottom of the page */
  :global(.monaco-alert) {
    display: none !important;
  }

</style>