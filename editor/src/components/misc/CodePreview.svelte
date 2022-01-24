<script>
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { iframePreview } from './misc';
  import {locale} from '../../stores/app/misc'
  import { convertFieldsToData } from '../../utils';
  import { getAllFields } from '../../stores/helpers';

  export let view = 'small';
  export let loading = false;
  export let hideControls = false;
  export let componentApp;
  export let error = null;
  export let fields = [];

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
    // set('preview', { html: '', css: '', js: '' });
    clearInterval(interval);
  });

  $: props = {
    // id,
    ...convertFieldsToData(getAllFields(fields)),
  };

  $: setIframeApp({
    iframeLoaded,
    componentApp,
    props,
  });
  function setIframeApp({ iframeLoaded, componentApp, props }) {
    if (iframeLoaded) {
      iframe.contentWindow.postMessage({ componentApp, props });
    }
  }

  $: setIframeData(props);
  function setIframeData(props) {
    if (iframeLoaded) {
      iframe.contentWindow.postMessage({ props });
    }
  }

  function setLoading(e) {
    if (!iframeLoaded) {
      iframeLoaded = true;
      return;
    }
    iframeLoaded = false;
    iframe.srcdoc = iframePreview($locale);
  }

  let previewWidth;

</script>

<div class="code-preview">
  {#if error}
    <pre
      transition:slide={{ duration: 100 }}
      class="error-container">
      {@html error}
    </pre>
  {/if}
  <div
    class="preview-container"
    class:loading
    bind:this={container}
    bind:clientWidth={previewWidth}>
    <iframe
      class:scaled={view === 'large'}
      on:load={setLoading}
      class:fadein={previewLoaded}
      title="Preview HTML"
      srcdoc={iframePreview($locale)}
      bind:this={iframe} />
  </div>
  {#if !hideControls}
    <div class="footer-buttons">
      {#if view === 'small'}
        <div class="preview-width">{previewWidth}</div>
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

<style lang="postcss">
  .code-preview {
    height: 100%;
    display: flex;
    flex-direction: column;

    .error-container {
      color: var(--primo-color-white);
      background: var(--primo-color-primored);
      padding: 5px;
    }
  }
  iframe {
    width: 100%;
    border: 0;
    transition: opacity 0.2s;
    background: var(--primo-color-white);
    height: 100%;
    width: 100%;
  }
  .fadein {
    opacity: 1;
  }
  iframe.scaled {
    width: 100vw;
    transform-origin: top left;
  }
  .preview-container {
    background: var(--primo-color-white);
    border: 2px solid var(--color-gray-8);
    overflow: hidden;
    transition: border-color 0.2s;
    will-change: border-color;
    border-bottom: 0;
    flex: 1;
  }
  .preview-container.loading {
    border-color: var(--primo-color-primored);
  }
  .footer-buttons {
    display: flex;
    flex-wrap: wrap;

    .preview-width {
      background: var(--primo-color-black);
      color: var(--primo-color-white);
      font-weight: 500;
      z-index: 10;
      display: flex;
      align-items: center;
      padding: 0 1rem;
    }
  }

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
  .footer-buttons button:hover {
    background: var(--color-gray-8);
  }

</style>
