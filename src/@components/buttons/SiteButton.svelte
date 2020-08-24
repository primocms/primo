<svelte:window on:resize={resizePreview} />

<script>
  import {onMount} from 'svelte'
  import {fade} from 'svelte/transition'
  import {buildPagePreview,wrapInStyleTags} from '../../utils'
  import {tailwind,pageData, site as siteStore} from '../../@stores/data'

  export let site
  export let isLink

  $: homePage = site.pages.filter(p => p.id === 'index')[0]

  $: preview = wrapInStyleTags($tailwind) + wrapInStyleTags(site.styles.final) + wrapInStyleTags(homePage.styles.final) + buildPagePreview(homePage.content)

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

  function navigateToSite() {
    $siteStore = site
  }
</script>

{#if isLink}
  <a href="https://{site.id}.primocloud.io">
    <div bind:this={container}>
      <iframe bind:this={iframe} style="transform: scale({scale})" class:fadein={iframeLoaded} title="page preview" srcdoc={preview} on:load={() => {resizePreview(); iframeLoaded = true }}></iframe>
    </div>
  </a>
{:else}
  <button on:click={navigateToSite}>
    <div bind:this={container}>
      <iframe bind:this={iframe} style="transform: scale({scale})" class:fadein={iframeLoaded} title="page preview" srcdoc={preview} on:load={() => {resizePreview(); iframeLoaded = true }}></iframe>
    </div>
  </button>
{/if}

<style>
  button {
    @apply cursor-pointer absolute bottom-0 top-0 left-0 right-0 z-10 bg-transparent opacity-100 transition-all duration-200 w-full h-full bg-white;
    &:hover {
      @apply opacity-25 bg-codeblack;
    }
  }
  iframe {
    @apply pointer-events-none opacity-0 transition-opacity duration-200 bg-white;
    width: 100vw;
    transform-origin: top left;
    height: 1000vh;
  }
  .fadein {
    @apply opacity-100;
  }
</style>