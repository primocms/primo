<svelte:window on:resize={resizePreview} />

<script>
  import {onMount} from 'svelte'
  import {fade} from 'svelte/transition'
  import {buildPagePreview,wrapInStyleTags} from '../../utils'
  import {site as siteStore} from '../../@stores/data'
  import tailwind from '../../@stores/data/tailwind'
  import pageData from '../../@stores/data/pageData'
  import {pageId} from '../../@stores/data/page'

  export let site
  export let isLink
  export let active

  $: homePage = site.pages.filter(p => p.id === 'index')[0]

  $: preview = wrapInStyleTags($tailwind) + wrapInStyleTags(site.styles ? site.styles.final : '') + wrapInStyleTags(homePage.styles ? homePage.styles.final : '') + buildPagePreview(homePage.content)

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
    pageId.set('index')
  }
</script>

{#if isLink}
  <a href="https://{site.id}.primocloud.io">
    <div bind:this={container}>
      <iframe bind:this={iframe} style="transform: scale({scale})" class:fadein={iframeLoaded} title="page preview" srcdoc={preview} on:load={() => {resizePreview(); iframeLoaded = true }}></iframe>
    </div>
  </a>
{:else}
  <button on:click={navigateToSite} class:active>
    <div bind:this={container} class:active>
      <iframe class:active bind:this={iframe} style="transform: scale({scale})" class:fadein={iframeLoaded} title="page preview" srcdoc={preview} on:load={() => {resizePreview(); iframeLoaded = true }}></iframe>
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
  .active {
    @apply opacity-25 bg-codeblack cursor-default pointer-events-none;
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