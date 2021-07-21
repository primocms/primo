<script>
  import { onMount } from 'svelte';
  import { pagePreview } from './misc';
  import { onMobile } from '../../stores/app/misc';

  export let preview;

  let container;
  let iframe;
  let iframeLoaded;
  $: preview && iframeLoaded && setIframeContent({ preview });
  function setIframeContent({ preview }) {
    console.log('adding');
    iframe.contentWindow.postMessage({ preview });
  }

  function resizePreview() {
    const { clientWidth: parentWidth } = container;
    const { clientWidth: childWidth } = iframe;
    const scaleRatio = parentWidth / childWidth;
    iframe.style.transform = `scale(${scaleRatio})`;
    iframe.style.height = 100 / scaleRatio + '%';
  }

  onMount(() => {
    setTimeout(resizePreview, 100);
  });

</script>

<div class="h-full flex flex-col">
  <div class="preview-container flex-1 bg-white" bind:this={container}>
    <iframe
      title="Preview HTML"
      srcdoc={pagePreview}
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
  .fadein {
    @apply opacity-100 duration-300;
  }
  .preview-container {
    will-change: border-color;
    @apply border-4 border-gray-800 transition-colors duration-200 overflow-hidden;
    border-bottom: 0;
  }

</style>
