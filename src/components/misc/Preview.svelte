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

<div class="preview">
  <div class="preview-container" bind:this={container}>
    <iframe
      in:fade={{ duration: 100 }}
      title="Preview HTML"
      srcdoc={preview}
      bind:this={iframe}
      on:load={() => (iframeLoaded = true)} />
  </div>
</div>

<svelte:window on:resize={resizePreview} />

<style lang="postcss">
  .preview {
    height: 100%;
    display: flex;
    flex-direction: column;

    .preview-container {
      background: var(--color-white);
      border: 4px solid var(--color-gray-8);
      transition: var(--transition-colors);
      overflow: hidden;
      border-bottom: 0;
      will-change: border-color;
      flex: 1;

      iframe {
        pointer-events: none;
        background: var(--color-white);
        border: 0;
        transition: opacity 0.1s;
        height: 100%;
        width: 100vw;
        transform-origin: top left;
      }
    }
  }

</style>
