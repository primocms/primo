<script>
  import {locale} from '../../../stores/app/misc'
  import Spinner from '../../../components/misc/Spinner.svelte';
  import { iframePreview } from '../../../components/misc/misc';

  export let componentApp;
  export let height;
  let container;
  let iframe;
  let iframeLoaded;
  let finishedResizing = false;
  $: componentApp && iframeLoaded && setIframeContent({ componentApp });
  function setIframeContent({ componentApp }) {
    iframe.contentWindow.postMessage({ componentApp });
    setScaleRatio();
    setTimeout(setHeight, 100);
    function setHeight() {
      iframe.height = '';
      const newHeight =
        iframe.contentWindow.document.body.scrollHeight * scaleRatio;
      iframe.height = newHeight;
      height = newHeight;
      finishedResizing = true;
    }
  }

  function setScaleRatio() {
    const { clientWidth: parentWidth } = container;
    const { clientWidth: childWidth } = iframe;
    scaleRatio = parentWidth / childWidth;
  }

  let scaleRatio = 1;

</script>

<svelte:window on:resize={setScaleRatio} />

{#if !iframeLoaded}
  <div class="spinner-container">
    <Spinner />
  </div>
{/if}
<div bind:this={container} class="iframe-container">
  <iframe
    class:fadein={finishedResizing}
    style="transform: scale({scaleRatio}); height: {100 / scaleRatio + '%'}"
    scrolling="no"
    on:load={() => (iframeLoaded = true)}
    title="Preview HTML"
    srcdoc={iframePreview($locale)}
    bind:this={iframe} />
</div>

<style lang="postcss">
  .spinner-container {
    background: var(--color-gray-9);
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
    background: var(--primo-color-white);
    position: absolute;
    inset: 0;
    height: 100%;

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
