<script>
  import {Spinner} from '../../../components/misc'
  import {fade} from 'svelte/transition'
  import { createEventDispatcher, onMount } from 'svelte';
  import 'requestidlecallback-polyfill';

  const dispatch = createEventDispatcher();
  import {createSymbolPreview} from '../../../utils'

  import {styles as siteStyles, wrapper} from '../../../stores/data/draft'
  import {styles as pageStyles} from '../../../stores/app/activePage'
  import { getTailwindConfig } from '../../../stores/helpers';
  import {processors} from '../../../component'
  import {getAllFields} from '../../../stores/helpers'
  import components from '../../../stores/app/components'
  import {
    convertFieldsToData
  } from "../../../utils";

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
<div class="component-wrapper flex flex-col border border-gray-900 bg-codeblack text-white rounded" in:fade={{ delay: 250, duration: 200 }} id="symbol-{symbol.id}">
  {#if titleEditable}
    <form class="cursor-pointer" on:submit|preventDefault={changeTitle}>
      <input class="cursor-pointer" type="text" bind:this={titleInput} bind:value={title} on:blur={changeTitle} on:focus={() => editingTitle = true}/>
    </form>
  {/if}
  <div class="flex justify-between items-center shadow-sm">
    <p class="component-label text-sm" on:click={() => titleInput && titleInput.focus()} class:editing={editingTitle}>
      {#if titleEditable}
        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg>
      {/if}
      <span>{title}</span>
    </p>
    <div class="flex">
      <button class="p-2" class:bg-red-900={copied} on:click={() => {
        copied = true
        dispatch('copy')
      }}>
        <span class="sr-only">Copy Symbol</span>
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"></path><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"></path></svg>
      </button>
      {#each buttons as button}
        <button class="p-2" class:bg-primored={button.highlight} on:click={button.onclick}>
          <span class="sr-only">{button.label}</span>
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
  .component-wrapper {
    @apply relative shadow;
    height: 40vh;
    overflow: hidden;
    content-visibility: auto;
  }
  button {
    @apply transition-colors duration-100 focus:outline-none focus:opacity-75;
  }
  button:hover {@apply bg-gray-800;}
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