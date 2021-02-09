<script context="module">
  import {writable} from 'svelte/store'
  const preview = writable({})
</script>

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

  export let symbol;
  export let title = symbol.title || '';
  export let buttons = []
  export let titleEditable

  let editingTitle = false
  let titleInput

  function changeTitle() {
    editingTitle = false
    if (title !== symbol.title) {
      dispatch('update', { title })
    }
  }

  function saveComponentHeight(newIframeHeight) {
    if (newIframeHeight !== symbol.height) {
      dispatch('update', { height })
    }
  }

  let iframe
  let iframeHeight = symbol.height || 250

  onMount(() => {
    const parentStyles = $siteStyles.final + $pageStyles.final
    const previewCode = createSymbolPreview({
      id: symbol.id,
      html: symbol.value.final.html,
      wrapper: $wrapper,
      js: symbol.value.final.js,
      css: parentStyles + symbol.value.final.css,
      tailwind: getTailwindConfig()
    });
    preview.update(p => ({
      ...p,
      [symbol.id]: previewCode
    }))

  })

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
    iframe.onload = () => {
      iframeHeight = iframe.contentWindow.document.body.scrollHeight
      // saveComponentHeight(iframeHeight)
    }
  } 

  let shouldLoadIframe = false
  onMount(() => {
    window.requestIdleCallback(() => {
      shouldLoadIframe = true
    })
  })

  let copied = false

</script>

<svelte:window on:resize={resizePreview} />
<div class="component-wrapper flex flex-col bg-primored text-white rounded" in:fade={{ delay: 250, duration: 200 }} id="symbol-{symbol.id}">
  <!-- <div class="message-header">
    <p class="component-label" on:click={() => titleInput.focus()} class:editing={editingTitle}>
      <i class="far fa-edit text-xs text-gray-500 cursor-pointer mr-2"></i>
      <span>{title}</span>
    </p>
    <div class="buttons">
      <IconButton variants="text-xs" icon="copy" on:click={() => dispatch('copy')} />  
      <IconButton label="Delete" variants="text-xs" icon="trash" on:click={() => dispatch('delete')} />  
      <IconButton label="Edit" variants="text-xs" icon="edit" on:click={() => dispatch('edit')} />  
      <IconButton label="Add" variants="is-main text-xs" icon="plus-circle" on:click={() => dispatch('select')} />  
    </div>
  </div> -->
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
        <button class="p-2" on:click={button.onclick}>
          <span class="sr-only">{button.label}</span>
          {@html button.svg}
        </button>
      {/each}
    </div>
  </div>
  <div class="bg-gray-100 flex-1 flex flex-col relative" bind:this={iframeContainer}>
    {#if !iframeLoaded}
      <div class="loading bg-primored w-full h-full left-0 top-0 absolute flex justify-center items-center z-50">
        <Spinner />
      </div>
    {/if}
    {#if shouldLoadIframe}
      <iframe on:load={() => {iframeLoaded = true}} class:fadein={iframeLoaded} style="transform: scale({scale})" class="w-full shadow-lg" bind:this={iframe} title="component preview" srcdoc={$preview[symbol.id]}></iframe>
    {/if}
    </div>
</div>

<style> 
  .component-wrapper {
    @apply relative shadow;
    height: 40vh;
    overflow: hidden;
  }
  button {
    @apply transition-colors duration-100;
    &:hover {@apply bg-red-700;}
  }
  .buttons {
    @apply flex justify-end;
  }
  iframe {
    @apply w-full opacity-0 transition-opacity duration-200;
    width: 50vw;
    min-width: 500px;
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
  /* 
  .component-wrapper:not(:last-child) {
    margin-bottom: 1rem;
  } */

</style>