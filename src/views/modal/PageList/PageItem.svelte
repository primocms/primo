<svelte:window on:resize={resizePreview} />

<script>
  import {onMount} from 'svelte'
  import {fade} from 'svelte/transition'
  import { navigate } from 'svelte-routing';
  import {buildPagePreview,wrapInStyleTags} from '../../../utils'
  import tailwind from '../../../stores/data/tailwind'
  import site from '../../../stores/data/site'
  import pageData from '../../../stores/data/pageData'
  import modal from '../../../stores/app/modal'

  export let page
  export let active = false

  $: preview = wrapInStyleTags($tailwind) + wrapInStyleTags($site.styles.final) + wrapInStyleTags(page.styles.final) + buildPagePreview(page.content)

  let iframeLoaded = false

  let container
  let iframe
  let scale

  function resizePreview() {
    const {clientWidth:parentWidth} = container
    const {clientWidth:childWidth} = iframe
    scale = parentWidth / childWidth
  }

  onMount(resizePreview)

  function openPage(e) {
    e.preventDefault()
    navigate(`/${page.id === 'index' ? '' : page.id}`)
    modal.hide()
  }
</script>


<div class="shadow-xl mb-4 rounded">
  <div class="w-full flex justify-between px-3 py-2 border-b border-gray-100">
    <div>
      <span class="text-xs font-semibold text-gray-700">{page.title}</span>
    </div>
    <div class="flex justify-end">
      {#if page.id !== 'index'}
        <button title="Delete page" on:click={() => dispatch('delete')} class="delete-page text-xs text-red-500 hover:text-red-600">
          <i class="fas fa-trash"></i>
        </button>
      {/if}
    </div>
  </div>
  <button class="page-container" on:click={openPage} class:active bind:this={container} aria-label="Go to /{page.id}">
    <iframe bind:this={iframe} style="transform: scale({scale})" class:fadein={iframeLoaded} title="page preview" srcdoc={preview} on:load={() => {iframeLoaded = true }}></iframe>
  </button>
</div>

<style>
  .page-title {
    @apply text-lg font-semibold transition-colors duration-100 items-start;
  }
  a.page-title {
    @apply underline text-blue-700;
  }
  a.page-title:hover {
    @apply text-blue-800;
  }
  button.page-container.active {
    @apply cursor-default opacity-50;
    &:after {
      @apply opacity-50;
    }
  }
  button.page-container {
    @apply block w-full relative overflow-hidden transition-colors duration-100;
    height: 15vh;

    &:after {
      content: '';
      @apply absolute top-0 left-0 right-0 bottom-0 bg-codeblack opacity-0 transition-opacity duration-100;
      pointer-events: all;
    }

    &:hover:after {
      @apply opacity-50;
    }
  }
  iframe {
    @apply pointer-events-none opacity-0 transition-opacity duration-200;
    width: 100vw;
    transform-origin: top left;
    height: 1000vh;
  }
  .fadein {
    @apply opacity-100;
  }
</style>