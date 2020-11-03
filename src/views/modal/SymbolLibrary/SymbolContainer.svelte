<script context="module">
  import {writable} from 'svelte/store'
  const preview = writable({})
</script>

<script>
  import {IconButton} from '../../../components/buttons'
  import {fade} from 'svelte/transition'
  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();
  import {createSymbolPreview} from '../../../utils'

  import tailwind from '../../../stores/data/tailwind'
  import {styles as siteStyles, wrapper} from '../../../stores/data/draft'
  import {styles as pageStyles} from '../../../stores/app/activePage'
  let styles = $siteStyles

  export let symbol;
  export let title = symbol.title || '';

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
  $: containerHeight = iframeHeight / 3

  onMount(() => {
    iframe.onload = () => {
      iframeHeight = iframe.contentWindow.document.body.scrollHeight
      // saveComponentHeight(iframeHeight)
    }
    const parentStyles = $tailwind + $siteStyles.final + $pageStyles.final
    const previewCode = createSymbolPreview({
      id: symbol.id,
      html: symbol.value.final.html,
      wrapper: $wrapper,
      js: symbol.value.final.js,
      css: parentStyles + symbol.value.final.css
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

  onMount(resizePreview)

</script>

<svelte:window on:resize={resizePreview} />
<div class="component-wrapper" in:fade={{ delay: 250, duration: 200 }} id="symbol-{symbol.id}">
  <form on:submit|preventDefault={changeTitle}>
    <input type="text" bind:this={titleInput} bind:value={title} on:blur={changeTitle} on:focus={() => editingTitle = true}/>
  </form>
  <div class="message-header">
    <p class="component-label" on:click={() => titleInput.focus()} class:editing={editingTitle}>
      <i class="far fa-edit text-xs text-gray-500 cursor-pointer mr-2"></i>
      <span>{title}</span>
    </p>
    <div class="buttons">
      <IconButton label="Delete" variants="text-xs" icon="trash" on:click={() => dispatch('delete')} />  
      <IconButton label="Edit" variants="text-xs" icon="edit" on:click={() => dispatch('edit')} />  
      <IconButton label="Add" variants="is-main text-xs" icon="plus-circle" on:click={() => dispatch('select')} />  
    </div>
  </div>
  <div bind:this={iframeContainer}>
    <iframe on:load={() => {iframeLoaded = true}} class:fadein={iframeLoaded} style="transform: scale({scale})" class="w-full shadow-lg" bind:this={iframe} title="component preview" srcdoc={$preview[symbol.id]}></iframe>
  </div>
</div>

<style> 
  .component-wrapper {
    @apply relative shadow;
    height: 30vh;
    overflow: hidden;
  }
  .buttons {
    @apply flex justify-end;
  }
  iframe {
    @apply w-full opacity-0 transition-opacity duration-200;
    /* transform: scale(0.333); */
    width: 50vw;
    height: 100vh;
    transform-origin: top left;
  }
  .fadein {
    @apply opacity-100;
  }
  .message-header {
    @apply flex justify-between items-center bg-gray-100 p-1;
  }
  .component-label {
    @apply flex items-center flex-1 text-sm font-semibold text-gray-800 pl-2;
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