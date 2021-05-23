<script>
  import {Spinner} from '../../../../components/misc'
  import {fade} from 'svelte/transition'
  import { createEventDispatcher, onMount } from 'svelte';
  import 'requestidlecallback-polyfill';

  const dispatch = createEventDispatcher();
  import {createSymbolPreview} from '../../../../utils'

  import {styles as siteStyles, wrapper} from '../../../../stores/data/draft'
  import {styles as pageStyles} from '../../../../stores/app/activePage'
  import { getTailwindConfig } from '../../../../stores/helpers';
  import {processors} from '../../../../component'
  import {getAllFields} from '../../../../stores/helpers'
  import components from '../../../../stores/app/components'
  import {
    convertFieldsToData
  } from "../../../../utils";

  export let symbol;
  export let title = symbol.title || '';
  export let buttons = []
  export let titleEditable
  export let loadPreview = true

  let editingTitle = false
  let titleInput

  function changeTitle() {
    editingTitle = false
    if (title !== symbol.title) {
      dispatch('update', { title })
    }
  }

  let iframe
  let iframeLoaded = false

  let scale
  let iframeContainer
  function resizePreview() {
    const { clientWidth: parentWidth } = iframeContainer;
    const { clientWidth: childWidth } = iframe;
    scale = parentWidth / childWidth;
  }

  $: if (iframe) {
    resizePreview()
  } 

  let mounted = false
  let shouldLoadIframe = true
  onMount(() => {
    mounted = true
    shouldLoadIframe = true
  })

  let copied = false

  let css
  $: mounted && processCSS(symbol.value.css)
  function processCSS(raw = '') {
    if (!raw) return
    const cachedCSS = $components[raw]
    if (cachedCSS) {
      css = cachedCSS
    } else {
      const tailwind = getTailwindConfig(true)
      const encapsulatedCss = `#component-${symbol.id} {${raw}}`;
      processors.css(encapsulatedCss, { tailwind }).then(res => {
        css = res || '/**/'
        $components[raw] = css
      })
    }
  }

  let html
  $: mounted && processHTML(symbol.value.html)
  function processHTML(raw = '') {
    if (!raw) return 
    const cachedHTML = $components[raw]
    if (cachedHTML) {
      html = cachedHTML
    } else {
      const allFields = getAllFields(symbol.value.fields);
      const data = convertFieldsToData(allFields);
      processors.html(raw, data).then(res => {
        html = res
        $components[raw] = html
      })
    }
  }

  let js
  $: mounted && processJS(symbol.value.js)
  function processJS(raw) {
    if (!raw) {
      js = `//` // set js to something to component renders
    } else {
      const allFields = getAllFields(symbol.value.fields)
      const data = convertFieldsToData(allFields)
      const finalJS = `
        const primo = {
          id: '${symbol.id}',
          data: ${JSON.stringify(data)},
          fields: ${JSON.stringify(allFields)}
        }
        ${raw.replace(/(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g,`import $1 from 'https://cdn.skypack.dev/$2'`)}`
      js = finalJS
    }
  }

  $: preview = buildPreview(html, css, js)
  function buildPreview(html, css, js) {
    if (!mounted || !html && !js && !css) return ``
    const parentStyles = $siteStyles.final + $pageStyles.final
    const previewCode = createSymbolPreview({
      id: symbol.id,
      html,
      wrapper: $wrapper,
      js,
      css: parentStyles + css,
      tailwind: getTailwindConfig()
    });

    return previewCode
  }

</script>

<svelte:window on:resize={resizePreview} />
<div class="component-wrapper flex flex-col shadow-xl text-white rounded" in:fade={{ delay: 250, duration: 200 }} id="symbol-{symbol.id}">
  {#if titleEditable}
    <form class="cursor-pointer" on:submit|preventDefault={changeTitle}>
      <input class="cursor-pointer" type="text" bind:this={titleInput} bind:value={title} on:blur={changeTitle} on:focus={() => editingTitle = true}/>
    </form>
  {/if}
  <div class="shadow-sm component-header">
    <p class="component-label text-xs font-medium ml-1">
      <span>{title}</span>
    </p>
    <div class="flex">
      {#each buttons as button}
        <button class="p-2 flex space-x-2 items-center" class:bg-primored={button.highlight} on:click={button.onclick}>
          <span class="text-xs font-semibold">{button.label}</span>
          {@html button.svg}
        </button>
      {/each}
    </div>
  </div>
  <div class="bg-gray-100 flex-1 flex flex-col relative" bind:this={iframeContainer}>
    {#if !iframeLoaded}
      <div class="loading bg-gray-900 w-full h-full left-0 top-0 absolute flex justify-center items-center z-50">
        <Spinner />
      </div>
    {/if}
    {#if loadPreview}
      <iframe on:load={() => iframeLoaded = true} class:fadein={iframeLoaded} style="transform: scale({scale})" class="w-full shadow-lg" bind:this={iframe} title="component preview" srcdoc={preview}></iframe>
    {/if}
    </div>
</div>

<style> 
  .component-header {
    margin-bottom: -2rem;
    z-index: 1;
    background: rgba(20,20,20,0.75);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .component-wrapper {
    @apply relative shadow;
    height: 40vh;
    overflow: hidden;
    content-visibility: auto;
  }
  button {
    @apply transition-colors duration-100 focus:outline-none focus:opacity-75;
  }
  button:hover {@apply bg-red-600;}
  .buttons {
    @apply flex justify-end;
  }
  iframe {
    @apply w-full opacity-0 transition-opacity duration-200;
    height: 300vw;
    transform-origin: top left;
  }
  .fadein {
    @apply opacity-100;
  }
  .message-header {
    @apply flex justify-between items-center bg-gray-100 p-1;
  }
  .component-label {
    @apply flex items-center flex-1 pl-2;
    min-width: 3rem;
    height: 1.5rem;
  }
  .component-label:before {
    content: '';
    display: inline-block;
    height: 1rem;
    width: 0;
    margin-right: 0;
    transition: margin-right 0.25s, width 0.25s;
    background: gainsboro;
  }
  input {
    user-select: none;
    position: absolute;
    opacity: 0;
  }
  .editing:before {
    content: '';
    width: 4px;
    margin-right: 5px;
    transition: margin-right 0.25s, width 0.25s;
  }
</style>