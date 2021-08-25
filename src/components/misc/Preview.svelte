<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { pagePreview } from './misc';
  import { onMobile } from '../../stores/app/misc';

  export let preview;
  export let preventClicks = false;

  let height;

  let container;
  let iframe;
  let iframeLoaded;
  $: preview && iframeLoaded && setIframeContent({ preview });
  function setIframeContent({ preview }) {
    iframe.contentWindow.postMessage({ preview });

    setTimeout(() => {
      iframe.height = '';
      height = iframe.contentWindow.document.body.scrollHeight * scaleRatio;
      iframe.height = height;
    }, 100);
  }

  let scaleRatio;
  function resizePreview() {
    const { clientWidth: parentWidth } = container;
    const { clientWidth: childWidth } = iframe;
    scaleRatio = parentWidth / childWidth;
    iframe.style.transform = `scale(${scaleRatio})`;
    iframe.style.height = 100 / scaleRatio + '%';
  }

  onMount(resizePreview);

</script>

<div class="preview" style="height:{height}px">
  <div class="preview-container" bind:this={container}>
    <iframe
      class:disable={preventClicks}
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
    overflow: hidden;

    .preview-container {
      background: var(--color-white);
      border: 4px solid var(--color-gray-8);
      transition: var(--transition-colors);
      overflow: hidden;
      border-bottom: 0;
      will-change: border-color;
      flex: 1;

      iframe {
        background: var(--color-white);
        border: 0;
        transition: opacity 0.1s;
        height: 100%;
        width: 100vw;
        transform-origin: top left;

        &.disable {
          pointer-events: none;
        }
      }
    }
  }

</style>
