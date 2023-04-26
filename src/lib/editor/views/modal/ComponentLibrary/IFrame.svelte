<script>
  import { tick } from 'svelte'
  import Spinner from '../../../components/misc/Spinner.svelte'
  import { componentPreview } from '../../../components/misc/misc'

  export let componentCode
  export let height

  let container
  let iframe
  let iframeLoaded
  let finishedResizing = false
  $: iframeLoaded && setIframeContent()
  async function setIframeContent() {
    setScaleRatio()
    await tick()
    setHeight()
  }

  function setHeight() {
    // iframe.height = '';
    const newHeight =
      iframe.contentWindow.document.body.scrollHeight * scaleRatio
    // iframe.height = newHeight;
    // iframe.width = newHeight;
    height = newHeight
    container_height = iframe.contentWindow.document.body.scrollHeight
    finishedResizing = true
  }

  function setScaleRatio() {
    if (!container || !iframe) return
    const { clientWidth: parentWidth } = container
    const { clientWidth: childWidth } = iframe
    scaleRatio = parentWidth / childWidth
  }

  let scaleRatio = 1
  let container_height

  let load_observer
  let resize_observer
  $: if (container && iframe) {
    if (load_observer) load_observer.disconnect()
    if (resize_observer) resize_observer.disconnect()
    resize_observer = new ResizeObserver(setScaleRatio).observe(
      container.closest('.sidebar')
    )
    load_observer = new ResizeObserver(() => {
      // workaround for on:load not working reliably
      if (iframe?.contentWindow.document.body?.childNodes) {
        setScaleRatio()
        setHeight()
      }
    }).observe(iframe)
  }
</script>

<svelte:window on:resize={setScaleRatio} />

<div class="IFrame">
  {#if !iframeLoaded}
    <div class="spinner-container">
      <Spinner />
    </div>
  {/if}
  <div
    bind:this={container}
    class="iframe-container"
    style:height="{container_height * scaleRatio}px"
  >
    {#if componentCode}
      <iframe
        class:fadein={finishedResizing}
        style:transform="scale({scaleRatio})"
        style:height={100 / scaleRatio + '%'}
        scrolling="no"
        title="Preview HTML"
        on:load={() => (iframeLoaded = true)}
        srcdoc={componentPreview(componentCode)}
        bind:this={iframe}
      />
    {/if}
  </div>
</div>

<style lang="postcss">
  .IFrame {
    position: relative;
    /* height: 100%; */
  }

  .spinner-container {
    /* background: var(--color-gray-9); */
    width: 100%;
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 50;
  }
  .iframe-container {
    /* background: var(--primo-color-white); */
    /* position: absolute; */
    inset: 0;
    /* height: 100%; */

    iframe {
      opacity: 0;
      transition: opacity 0.2s;
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      width: 100vw;
      transform-origin: top left;
      height: 100%;

      &.fadein {
        opacity: 1;
      }
    }
  }
</style>
