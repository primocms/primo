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

<button on:click={openPage} class="page-preview" bind:this={container} aria-label="Go to /{page.id}">
  <iframe bind:this={iframe} style="transform: scale({scale})" class:fadein={iframeLoaded} title="page preview" srcdoc={preview} on:load={() => {iframeLoaded = true }}></iframe>
</button>

<style>
  .page-preview {
    @apply block w-full relative overflow-hidden;
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
    @apply pointer-events-none opacity-0 transition-opacity duration-200;
    width: 100vw;
    transform-origin: top left;
    height: 1000vh;
  }
  .fadein {
    @apply opacity-100;
  }
</style>