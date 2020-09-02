<svelte:window on:resize={resizePreview} />

<script>
  import {onMount} from 'svelte'
  import {fade} from 'svelte/transition'
  import {buildPagePreview,wrapInStyleTags} from '../../utils'
  import {site,tailwind,pageData} from '../../@stores/data'
  import { modal } from '../../@stores/app'
  import { link } from 'svelte-routing';

  export let page

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
</script>

<a use:link on:click={() => modal.hide()} class="page-preview" bind:this={container} href="/{page.id === 'index' ? '' : page.id}" aria-label="Go to /{page.id}">
  <iframe bind:this={iframe} style="transform: scale({scale})" class:fadein={iframeLoaded} title="page preview" srcdoc={preview} on:load={() => {iframeLoaded = true }}></iframe>
</a>

<style>
  .page-preview {
    @apply block relative overflow-hidden pointer-events-none;
    height: 15vh;

    &:after {
      content: '';
      @apply absolute top-0 left-0 right-0 bottom-0 bg-primored opacity-0 transition-opacity duration-100;
      pointer-events: all;
    }

    &:hover:after {
      opacity: 0.5;
    }
  }
  iframe {
    @apply opacity-0 transition-opacity duration-200;
    width: 100vw;
    transform-origin: top left;
    height: 1000vh;
  }
  .fadein {
    @apply opacity-100;
  }
</style>