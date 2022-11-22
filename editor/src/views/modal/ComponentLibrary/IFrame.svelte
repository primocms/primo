<script>
  import Spinner from '../../../components/misc/Spinner.svelte';
  import { componentPreview } from '../../../components/misc/misc';

  export let componentApp;
  export let componentData = {}
  export let height;

  let container;
  let iframe;
  let iframeLoaded;
  let finishedResizing = false;
  $: componentApp && iframeLoaded && setIframeContent({ componentApp, componentData });
  function setIframeContent({ componentApp, componentData }) {
    iframe.contentWindow.postMessage({ componentApp, componentData });
    setScaleRatio();
    setTimeout(setHeight, 100);
    function setHeight() {
      iframe.height = '';
      const newHeight =
        iframe.contentWindow.document.body.scrollHeight * scaleRatio;
      iframe.height = newHeight;
      height = newHeight;
      container_height = iframe.contentWindow.document.body.scrollHeight
      finishedResizing = true;
    }
  }

  $: setIframeData(componentData);
  function setIframeData(componentData) {
    if (iframeLoaded) {
      iframe.contentWindow.postMessage({ componentData });
    }
  }

  function setScaleRatio() {
    const { clientWidth: parentWidth } = container;
    const { clientWidth: childWidth } = iframe;
    scaleRatio = parentWidth / childWidth;
  }

  let scaleRatio = 1;
  let container_height

</script>

<svelte:window on:resize={setScaleRatio} />

<div class="IFrame">
  {#if !iframeLoaded}
    <div class="spinner-container">
      <Spinner />
    </div>
  {/if}
  <div bind:this={container} class="iframe-container" style:height="{container_height*scaleRatio}px">
    {#if componentApp && componentData}
      <iframe
        class:fadein={finishedResizing}
        style="transform: scale({scaleRatio}); height: {100 / scaleRatio + '%'}"
        scrolling="no"
        on:load={() => (iframeLoaded = true)}
        title="Preview HTML"
        srcdoc={componentPreview(componentApp, componentData)}
        bind:this={iframe} />
    {/if}
  </div>
</div>

<style lang="postcss">
  .IFrame {
    position: relative;
    /* height: 100%; */
  }
  
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
