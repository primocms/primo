<script>
  import {onMount, createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import {buildPagePreview,wrapInStyleTags} from '../../../utils'
  import {styles as siteStyles} from '../../../stores/data/draft'
  import modal from '../../../stores/app/modal'
  import {getTailwindConfig} from '../../../stores/helpers'

  export let page;
  export let active = false;
  export let disableAdd = false
  export let parent = null

  $: preview =
    wrapInStyleTags($siteStyles.final) +
    wrapInStyleTags(page.styles.final) +
    buildPagePreview(page.content, getTailwindConfig());

  let iframeLoaded = false;

  let container;
  let iframe;
  let scale;

  function resizePreview() {
    const { clientWidth: parentWidth } = container;
    const { clientWidth: childWidth } = iframe;
    scale = parentWidth / childWidth;
  }

  $: if (iframe) {
    resizePreview()
  } 

  function openPage(e) {
    e.preventDefault()
    modal.hide(page.id)
  }


  let shouldLoadIframe = false
  onMount(() => {
    window.requestIdleCallback(() => {
      shouldLoadIframe = true
    })
  })

</script>

<svelte:window on:resize={resizePreview} />
<div class="shadow-lg rounded">
  <div class="text-gray-700 w-full flex justify-between px-3 py-2 border-b border-gray-100">
    <div>
      <span class="text-xs font-semibold">{page.title}</span>
    </div>
    <div class="flex justify-end">
      {#if page.pages && !disableAdd}
        <button
          title="Show sub-pages"
          on:click={() => dispatch('list')}
          class="p-1 text-xs">
          <i class="fas fa-th-large" />
        </button>
      {:else if page.id !== 'index' && !disableAdd}
        <button
          title="Add sub-page"
          on:click={() => dispatch('add')}
          class="p-1 text-xs">
          <i class="fas fa-plus" />
        </button>
      {/if}
      {#if page.id !== 'index'}
        <button
          title="Delete page"
          on:click={() => dispatch('delete')}
          class="ml-1 p-1 delete-page text-xs text-red-500 hover:text-red-600">
          <i class="fas fa-trash" />
        </button>
      {/if}
    </div>
  </div>
  <a
    class="page-container"
    href="/{page.id}"
    on:click={openPage}
    class:active
    bind:this={container}
    aria-label="Go to /{page.id}">
    {#if shouldLoadIframe}
      <iframe
      bind:this={iframe}
      style="transform: scale({scale})"
      class:fadein={iframeLoaded}
      title="page preview"
      srcdoc={preview}
      on:load={() => {
        iframeLoaded = true;
      }} /> 
    {/if}
  </a>
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
  a.page-container.active {
    @apply cursor-default pointer-events-none opacity-50;
    &:after {
      @apply opacity-50;
    }
  }
  a.page-container {
    @apply cursor-pointer block w-full relative overflow-hidden transition-colors duration-100;
    height: 15vh;

    &:after {
      content: "";
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
