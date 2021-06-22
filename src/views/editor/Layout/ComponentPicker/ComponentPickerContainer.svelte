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
<div class="component-wrapper component" in:fade={{ delay: 250, duration: 200 }} id="symbol-{symbol.id}">
  {#if titleEditable}
    <form on:submit|preventDefault={changeTitle}>
      <input type="text" bind:this={titleInput} bind:value={title} on:blur={changeTitle} on:focus={() => editingTitle = true}/>
    </form>
  {/if}
  <div class="component-header">
    <p class="component-label">
      <span>{title}</span>
    </p>
    <div style="display: flex">
      {#each buttons as button}
        <button class=" focus:outline-none focus:opacity-75 space-x-2" class:bg-primored={button.highlight} on:click={button.onclick}>
          <span>{button.label}</span>
          {@html button.svg}
        </button>
      {/each}
    </div>
  </div>
  <div class="component-frame" bind:this={iframeContainer}>
    {#if !iframeLoaded}
      <div class="component-spinner loading">
        <Spinner />
      </div>
    {/if}
    {#if loadPreview}
      <iframe on:load={() => iframeLoaded = true} class:fadein={iframeLoaded} style="box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) width: 100% transform: scale({scale})" bind:this={iframe} title="component preview" srcdoc={preview}></iframe>
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
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }
  .component {
    display: flex;
    flex-direction: column;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    color: rgba(255, 255, 255, var(--tw-text-opacity));
     border-radius: 0.25rem/* 4px */;
  }
  .component-wrapper {
    height: 40vh;
    overflow: hidden;
    position: relative;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    content-visibility: auto;
  }
  button {
    /* focus:outline-none focus:opacity-75; */
    transition-property: background-color, border-color, color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    transition-duration: 100ms;
    padding: 0.5rem/* 8px */;
    display: flex;
    align-items: center;
  }
  button span{
        font-size: 0.75rem/* 12px */;
        line-height: 1rem/* 16px */;
        font-weight: 600;
    }

  button:hover {background-color: rgba(220, 38, 38, var(--tw-bg-opacity));}
  .buttons {
    display: flex;
    justify-content: flex-end;
  }
  iframe {
    height: 300vw;
    width: 100%;
    transform-origin: top left;
    opacity: 0;
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms; /* is this still needed  */
    transition-duration: 200ms;
  }
  .fadein {
     opacity: 1;
  }
  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: rgba(245, 245, 245, var(--tw-bg-opacity));
    padding: 0.25rem/* 4px */;
  }
  .component-label {
    display: flex;
    align-items: center;
    flex: 1 1 0%;
    padding-left: 0.5rem/* 8px */;
    min-width: 3rem;
    height: 1.5rem;
    font-size: 0.75rem/* 12px */;
    line-height: 1rem/* 16px */;
    font-weight: 500;
    margin-left: 0.25rem/* 4px */;
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
    cursor: pointer;
  }
  .editing:before {
    content: '';
    width: 4px;
    margin-right: 5px;
    transition: margin-right 0.25s, width 0.25s;
  }
  form{
    cursor: pointer;
  }
  .component-frame{
    display: flex;
    flex-direction: column;
    position: relative;
    background-color: rgba(245, 245, 245, var(--tw-bg-opacity));
    flex: 1 1 0%;
  }
  .component-spinner{
    background-color: rgba(23, 23, 23, var(--tw-bg-opacity));
     width: 100%;
     height: 100%;
     left: 0px;
     top: 0px;
     position: absolute;
     display: flex;
     justify-content: center;
     align-items: center;
     z-index: 50;
  }
</style>