<script>
  import { browser } from '$app/env'
  import { find as _find } from 'lodash-es'
  import Spinner from '$lib/ui/Spinner.svelte'
  import { downloadPagePreview } from '../../supabase/storage'
  import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'

  export let site = null
  export let preview = null
  export let valid = true

  let generatedPreview

  let container
  let scale
  let iframe
  let iframeLoaded

  function resizePreview() {
    const { clientWidth: parentWidth } = container
    const { clientWidth: childWidth } = iframe
    scale = parentWidth / childWidth
  }

  async function getPreview(site) {
    generatedPreview =
      (await downloadPagePreview(site.id)) ||
      (await buildStaticPage({
        page: _find(site.pages, ['id', 'index']),
        site,
      }))

    if (!generatedPreview) {
      valid = false
    } else {
      valid = true
    }
  }

  // wait for processor to load before building preview
  let processorLoaded = false
  setTimeout(() => {
    processorLoaded = true
  }, 500)

  $: !preview && browser && processorLoaded && getPreview(site)
</script>

<svelte:window on:resize={resizePreview} />

<div class="iframe-root">
  <div bind:this={container} class="iframe-container">
    {#if !iframeLoaded && valid}
      <div class="spinner">
        <Spinner />
      </div>
    {/if}
    {#if preview || generatedPreview}
      <iframe
        tabindex="-1"
        bind:this={iframe}
        style="transform: scale({scale})"
        class:fadein={iframeLoaded}
        title="page preview"
        srcdoc={preview || generatedPreview}
        on:load={() => {
          resizePreview()
          iframeLoaded = true
        }}
      />
    {:else if !valid}
      <div class="invalid-state">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>Site file is invalid</span>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .iframe-root {
    pointer-events: none;
    overflow: hidden;
    position: relative;
    padding-top: var(--thumbnail-height, 75%);
  }
  .iframe-container {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: transparent;
    opacity: 1;
    transition: opacity 0.1s;
    width: 100%;
    height: 100%;
    font-size: 0.75rem;
    line-height: 1rem;
    overflow: hidden;
    overflow-wrap: break-word;
  }
  iframe {
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
    background: var(--color-white);
    width: 100vw;
    will-change: opacity;
    transform-origin: top left;
    height: 1000vh;
  }
  .fadein {
    opacity: 1;
  }
  .spinner {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .invalid-state {
    height: 100%;
    color: var(--primo-color-white);
    display: grid;
    place-content: center;
    place-items: center;
    gap: 0.25rem;

    svg {
      width: 2rem;
      height: 2rem;
    }
  }
</style>
