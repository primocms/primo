<script>
  import Spinner from '$lib/ui/Spinner.svelte'

  export let preview = null

  let container
  let scale
  let iframe
  let iframeLoaded

  function resizePreview() {
    if (!container || !iframe) return
    const { clientWidth: parentWidth } = container
    const { clientWidth: childWidth } = iframe
    scale = parentWidth / childWidth
  }

</script>

<svelte:window on:resize={resizePreview} />

<div class="iframe-root">
  <div bind:this={container} class="iframe-container">
    {#if !iframeLoaded}
      <div class="spinner">
        <Spinner />
      </div>
    {/if}
    {#if preview !== null}
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
  .spinner {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
