<script>
  import { browser } from '$app/environment'
  import { find as _find } from 'lodash-es'
  import { page } from '$app/stores'

  const { supabase } = $page.data

  /** @type {import('$lib').Site} */
  export let site
  export let preview = null

  if (!preview && site) {
    supabase.storage
      .from('sites')
      .download(`${site.id}/preview.html`)
      .then(({ data, error }) => {
        if (error) {
          console.log('Error downloading file: ', error.message)
        } else if (browser) {
          var reader = new FileReader()
          reader.onload = function () {
            preview = reader.result
          }
          reader.readAsText(data)
        }
      })
  }

  let container
  let scale
  let iframe
  let iframeLoaded

  function resizePreview() {
    const { clientWidth: parentWidth } = container
    const { clientWidth: childWidth } = iframe
    scale = parentWidth / childWidth
  }

  // wait for processor to load before building preview
  let processorLoaded = false
  setTimeout(() => {
    processorLoaded = true
  }, 500)
</script>

<svelte:window on:resize={resizePreview} />

<div class="iframe-root">
  <div bind:this={container} class="iframe-container">
    {#if browser}
      <iframe
        tabindex="-1"
        bind:this={iframe}
        style="transform: scale({scale})"
        class:fadein={iframeLoaded}
        title="page preview"
        srcdoc={preview}
        on:load={() => {
          resizePreview()
          iframeLoaded = true
        }}
      />
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
</style>
