<script>
  import { onMount } from 'svelte';
  import Spinner from '../../../components/misc/Spinner.svelte';
  import { iframePreview } from '../../../components/misc/misc';

  export let componentApp;
  let container;
  let iframe;
  let iframeLoaded;
  $: componentApp && iframeLoaded && setIframeContent({ componentApp });
  function setIframeContent({ componentApp }) {
    iframe.contentWindow.postMessage({ componentApp });
  }

  function resizePreview() {
    const { clientWidth: parentWidth } = container;
    const { clientWidth: childWidth } = iframe;
    const scaleRatio = parentWidth / childWidth;
    iframe.style.transform = `scale(${scaleRatio})`;
    iframe.style.height = 100 / scaleRatio + '%';
  }

  onMount(resizePreview);

</script>

{#if !iframeLoaded}
  <div class="spinner-container">
    <Spinner />
  </div>
{/if}
<div bind:this={container} class="iframe-container">
  <iframe
    scrolling="no"
    on:load={() => (iframeLoaded = true)}
    title="Preview HTML"
    srcdoc={iframePreview}
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
    background: var(--color-white);
    flex: 1;
    padding-top: 50%;
    height: 0;
    position: relative;

    iframe {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      width: 100vw;
      transform-origin: top left;
      height: 100%;
    }
  }

</style>
