<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { pagePreview } from './misc';
  import { onMobile } from '../../stores/app/misc';

  export let preview;

  let container;
  let iframe;
  let iframeLoaded;
  $: preview && iframeLoaded && setIframeContent({ preview });
  function setIframeContent({ preview }) {
    iframe.contentWindow.postMessage({ preview });
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

<div class="h-full flex flex-col">
  <div class="preview-container flex-1 bg-white" bind:this={container}>
    <iframe
      in:fade={{ duration: 100 }}
      title="Preview HTML"
      srcdoc={preview}
      class="bg-white w-full h-full"
      bind:this={iframe}
      on:load={() => (iframeLoaded = true)} />
  </div>
</div>

<svelte:window on:resize={resizePreview} />

<style>
  iframe {
    @apply w-full border-0 transition-opacity duration-300;
    width: 100vw;
    transform-origin: top left;
  }
  .preview-container {
    will-change: border-color;
    @apply border-4 border-gray-800 transition-colors duration-200 overflow-hidden;
    border-bottom: 0;
  }

</style>
