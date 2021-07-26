<script>
  import { onMount, onDestroy } from 'svelte';
  import { set } from 'idb-keyval';
  import { isEqual } from 'lodash';
  import { BroadcastChannel } from 'broadcast-channel';
  import { iframePreview } from './misc';
  import { onMobile } from '../../stores/app/misc';

  export let id = '';
  export let html = '';
  export let css = '';
  export let js = '';
  export let tailwind = {};
  export let view = 'small';
  export let loading = false;
  export let hideControls = false;
  export let componentApp;
  export let error = null;

  // used in separate tab preview
  const BC = new BroadcastChannel('preview');
  $: BC.postMessage({ id, html, css, js });
  $: set('preview', { id, html, css, js });

  let iframe;
  let previewLoaded = false;
  $: if (iframe) {
    iframe.contentWindow.addEventListener('message', ({ data }) => {
      if (data === 'done') {
        previewLoaded = true;
      }
    });
  }

  let container;
  let iframeLoaded = false;

  function resizePreview() {
    if (view) {
      const { clientWidth: parentWidth } = container;
      const { clientWidth: childWidth } = iframe;
      const scaleRatio = parentWidth / childWidth;
      iframe.style.transform = `scale(${scaleRatio})`;
      iframe.style.height = 100 / scaleRatio + '%';
    }
  }

  function changeView() {
    iframe.classList.remove('fadein');
    setTimeout(() => {
      if (view === 'small') {
        view = 'large';
        // clientWidth doesn't compute right without this
        setTimeout(resizePreview, 100);
      } else {
        iframe.classList.remove('fadein');
        iframe.style.transform = 'scale(1)';
        iframe.style.height = '100%';
        view = 'small';
      }
      setTimeout(() => {
        iframe.classList.add('fadein');
      }, 100);
    }, 100);
  }

  let interval;
  onMount(() => {
    interval = setInterval(resizePreview, 500);
  });
  onDestroy(() => {
    set('preview', { html: '', css: '', js: '' });
    clearInterval(interval);
  });

  // Necessary to reload tw config
  let cachedTailwind = tailwind;
  $: resetIframe(tailwind);
  function resetIframe() {
    if (!isEqual(tailwind, cachedTailwind)) {
      cachedTailwind = tailwind;
      iframeLoaded = false;
    }
  }

  $: setIframeContent({ iframeLoaded, componentApp, error });
  function setIframeContent({ iframeLoaded, componentApp, error }) {
    if (iframeLoaded) {
      iframe.contentWindow.postMessage({ componentApp, error });
    }
  }

  function setLoading(e) {
    if (!iframeLoaded) {
      iframeLoaded = true;
      return;
    }
    iframeLoaded = false;
    iframe.srcdoc = iframePreview;
  }

</script>

<div class="h-full flex flex-col">
  <div
    class="preview-container flex-1 bg-white"
    class:loading
    bind:this={container}>
    <iframe
      class:scaled={view === 'large'}
      on:load={setLoading}
      class:fadein={previewLoaded}
      title="Preview HTML"
      srcdoc={iframePreview}
      class="bg-white w-full h-full"
      bind:this={iframe} />
  </div>
  {#if !hideControls}
    <div class="footer-buttons">
      {#if view === 'small'}
        <button class="switch-view" on:click={changeView}>
          <i class="fas fa-expand-arrows-alt" />
          <span>window view</span>
        </button>
      {:else if view === 'large'}
        <button class="switch-view" on:click={changeView}>
          <i class="fas fa-compress-arrows-alt" />
          <span>contained view</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<svelte:window on:resize={resizePreview} />

<style>
  iframe {
    width: 100%;
    border: 0;
    transition: opacity 0.2s;
  }
  .fadein {
    opacity: 1;
  }
  iframe.scaled {
    width: 100vw;
    transform-origin: top left;
  }
  .preview-container {
    border: 4px solid var(--color-gray-8);
    overflow: hidden;
    transition: border-color 0.2s;
    will-change: border-color;
    border-bottom: 0;
  }
  .preview-container.loading {
    border-color: var(--color-primored);
  }
  .footer-buttons {
    display: flex;
    flex-wrap: wrap;
  }

  .footer-buttons a,
  .footer-buttons button {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    min-width: 12rem;
    flex: 1;
    outline: 0;
    background: var(--color-gray-9);
    border: 1px solid var(--color-gray-8);
    color: var(--color-gray-2);
    font-size: var(--font-size-1);
    padding: 0.5rem 0;
    display: block;
    text-align: center;
    transition: var(--transition-colors);
  }
  .footer-buttons a:hover,
  .footer-buttons button:hover {
    background: var(--color-gray-8);
  }

</style>
