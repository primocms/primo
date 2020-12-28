<script>
  import {onMount, createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  // import { navigate } from 'svelte-routing';
	import {push} from 'svelte-spa-router'

  import {buildPagePreview,wrapInStyleTags} from '../../../utils'
  import tailwind from '../../../stores/data/tailwind'
  // import site from '../../../stores/data/site'
  import {styles as siteStyles} from '../../../stores/data/draft'
  import modal from '../../../stores/app/modal'

  export let page;
  export let active = false;

  $: preview =
    wrapInStyleTags($tailwind) +
    wrapInStyleTags($siteStyles.final) +
    wrapInStyleTags(page.styles.final) +
    buildPagePreview(page.content);

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
    if (window.location.pathname.includes('site')) {
      const [ site ] = window.location.pathname.split('/').slice(2)
      // navigate(`/site/${site}/${page.id === 'index' ? '' : page.id}`) 
    } else {
      // navigate(`/${page.id === 'index' ? '' : page.id}`) 
    }
    modal.hide(page.id === 'index' ? '' : page.id)
  }


  let shouldLoadIframe = false
  onMount(() => {
    window.requestIdleCallback(() => {
      shouldLoadIframe = true
    })
  })
</script>

<svelte:window on:resize={resizePreview} />
<div class="shadow-xl rounded">
  <div class="w-full flex justify-between px-3 py-2 border-b border-gray-100">
    <div>
      <span class="text-xs font-semibold text-gray-700">{page.title}</span>
    </div>
    <div class="flex justify-end">
      {#if page.id !== 'index'}
        <button
          title="Delete page"
          on:click={() => dispatch('delete')}
          class="delete-page text-xs text-red-500 hover:text-red-600">
          <i class="fas fa-trash" />
        </button>
      {/if}
    </div>
  </div>
  <button
    class="page-container"
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
    @apply cursor-default pointer-events-none opacity-50;
    &:after {
      @apply opacity-50;
    }
  }
  button.page-container {
    @apply block w-full relative overflow-hidden transition-colors duration-100;
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
