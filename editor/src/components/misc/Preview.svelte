<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  export let preview;
  export let preventClicks = false;
  export let ratio = null

  let height;

  let container;
  let iframe;
  $: preview && iframe && setIframeContent({ preview });
  function setIframeContent({ preview }) {
    iframe.contentWindow.postMessage({ preview });

    setTimeout(() => {
      const scrollHeight = iframe?.contentWindow?.document?.body?.scrollHeight // prevent weird error
      if (!scrollHeight) return
      height = iframe.contentWindow?.document?.body?.scrollHeight * scaleRatio;
      iframe.height = height;
    }, 100);
  }

  let scaleRatio;
  function resizePreview() {
    const { clientWidth: parentWidth } = container;
    const { clientWidth: childWidth } = iframe;
    scaleRatio = ratio || (parentWidth / childWidth);
    iframe.style.transform = `scale(${scaleRatio})`;
    iframe.style.height = 100 / scaleRatio + '%';
  }

  onMount(resizePreview);

</script>

<div class="preview" style="height:{ratio === 1 ? '100%' : `${height}px`}">
  <div class="preview-container" bind:this={container}>
    <iframe
      class:disable={preventClicks}
      in:fade={{ duration: 100 }}
      title="Preview HTML"
      srcdoc={preview}
      bind:this={iframe} />
  </div>
</div>

<svelte:window on:resize={resizePreview} />

<style lang="postcss">
  .preview {
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .preview-container {
      background: var(--primo-color-white);
      border: 2px solid var(--color-gray-8);
      transition: var(--transition-colors);
      overflow: hidden;
      border-bottom: 0;
      will-change: border-color;
      flex: 1;

      iframe {
        background: var(--primo-color-white);
        border: 0;
        transition: opacity 0.1s;
        height: 100%;
        width: var(--Preview-iframe-width, 100vw);
        transform-origin: top left;

        &.disable {
          pointer-events: none;
        }
      }
    }
  }

</style>
