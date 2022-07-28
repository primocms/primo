<script context="module">
  import {writable} from 'svelte/store'
  export const autoRefresh = writable(true)
</script>

<script>
  import { onMount, onDestroy } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { iframePreview } from './misc';
  import {locale,highlightedElement} from '../../stores/app/misc'
  import JSONTree from 'svelte-json-tree';
  import Icon from '@iconify/svelte'

  export let view = 'small';
  export let orientation = 'horizontal'
  export let loading = false;
  export let hideControls = false;
  export let componentApp;
  export let error = null;
  export let data = {}

  const channel = new BroadcastChannel('component_preview');
  channel.onmessage = ({data}) => {
    const { event, payload } = data
    if (event === 'SET_CONSOLE_LOGS') {
      consoleLog = data.payload.logs
    } else if (event === 'SET_ELEMENT_PATH') {
      const {loc} = payload
      if (!loc || (activeLoc.char === loc.char && activeLoc.line === loc.line)) return
      $highlightedElement = loc
      activeLoc = { ...loc }
    }
  }

  let consoleLog

  let iframe;
  let activeLoc = { line: null, column: null, char: null }
  $: if (iframe) {    
    // open clicked links in browser
    iframe.contentWindow.document.querySelectorAll('a').forEach((link) => { link.target = '_blank' })
  }

  let container;
  let iframeLoaded = false;

  function resizePreview() {
    if (view && container && iframe) {
      const { clientWidth: parentWidth } = container;
      const { clientWidth: childWidth } = iframe;
      const scaleRatio = parentWidth / childWidth;
      iframe.style.transform = `scale(${scaleRatio})`;
      iframe.style.height = 100 / scaleRatio + '%';
    }
  }

  function changeView() {
    visible = false
    // iframe.classList.remove('fadein');
    setTimeout(() => {
      if (view === 'small') {
        view = 'large';
        // clientWidth doesn't compute right without this
        setTimeout(resizePreview, 100);
      } else {
        iframe.style.transform = 'scale(1)';
        iframe.style.height = '100%';
        view = 'small';
      }
      setTimeout(() => {
        visible = true
      }, 100);
    }, 100);
  }

  let interval;
  onMount(() => {
    interval = setInterval(resizePreview, 500);
  });
  onDestroy(() => {
    clearInterval(interval);
  });

  $: componentData = data

  $: setIframeApp({
    iframeLoaded,
    componentApp
  });
  function setIframeApp({ iframeLoaded, componentApp }) {
    if (iframeLoaded) {
      channel.postMessage({
        event: 'SET_APP',
        payload: { componentApp, componentData }
      });
    }
  }

  $: setIframeData(componentData);
  function setIframeData(componentData) {
    if (iframeLoaded) {
      channel.postMessage({
        event: 'SET_APP_DATA',
        payload: { componentData }
      });
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
  // $: if (previewWidth < 300) previewWidth = 300


  $: activeIcon = getIcon(previewWidth)
  function getIcon(width) {
    if (width < 500) {
      return "bi:phone"
    } else if (width < 1200) {
      return 'ant-design:tablet-outlined'
    } else if (width < 1800) {
      return "bi:laptop"
    } else {
      return 'akar-icons:desktop-device'
    }
  }

  let visible = true

  function toggleOrientation() {
    if (orientation === 'vertical') {
      orientation = 'horizontal'
    } else if (orientation === 'horizontal') {
      orientation = 'vertical'
    }
  }

</script>

<div class="code-preview">
  {#if error}
    <pre
      transition:slide={{ duration: 100 }}
      class="error-container">
      {@html error}
    </pre>
  {/if}

  {#if consoleLog}
    <div class="logs" transition:slide>
      <div class="log">
        {#if typeof consoleLog === 'object'}
          <JSONTree value={consoleLog} />
        {:else}
          <pre>{@html consoleLog}</pre> 
        {/if}
      </div>
    </div>
  {/if}
  <div
    in:fade
    style=""
    class="preview-container"
    class:loading
    bind:this={container}
    bind:clientWidth={previewWidth}>
    <iframe
      class:visible
      class:scaled={view === 'large'}
      on:load={setLoading}
      title="Preview HTML"
      srcdoc={iframePreview($locale)}
      bind:this={iframe} />
  </div>
  {#if !hideControls}
    <div class="footer-buttons">
      <div class="preview-width">
        <Icon icon={activeIcon} height="1rem" />
        <span>{previewWidth}</span>
      </div>
      <button class="switch-view" on:click={changeView}>
        <i class="fas { view === 'small' ? 'fa-compress-arrows-alt' : 'fa-expand-arrows-alt'}" />
        <span>{ view === 'small' ? 'contained' : 'screen'} width</span>
      </button>
      <button on:click={toggleOrientation} class="preview-orientation">
        {#if orientation === 'vertical'}
          <Icon icon="charm:layout-rows" />
        {:else if orientation === 'horizontal'}
        <Icon icon="charm:layout-columns" />
        {/if}
      </button>
      <button title="Toggle auto-refresh (refresh with Command R)" class="auto-refresh" class:toggled={$autoRefresh} on:click={() => $autoRefresh = !$autoRefresh}>
        <Icon icon="bx:refresh" />
      </button>
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
      background: red;
      padding: 5px;
    }

    .logs {
      --json-tree-font-family: 'Fira Code', serif, monospace;
      --json-tree-label-color: #569cd6;

      display: grid;
      gap: 0.5rem;
      background: var(--color-gray-9);
      border: 2px solid var(--color-gray-8);
      padding: 0.75rem 1rem;

      pre {
        display: block;
      }

      .log:not(:only-child):not(:last-child) {
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(250, 250, 250, 0.2);
      }
    }
  }
  iframe {
    width: 100%;
    border: 0;
    transition: opacity 0.4s;
    background: var(--primo-color-white);
    height: 100%;
    width: 100%;
    opacity: 1;

    &.visible {
      opacity: 1;
    }

    &.scaled {
      width: 100vw;
      transform-origin: top left;
    }
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
    border-color: var(--color-gray-7);
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

      span {
        padding-left: 0.5rem;
        font-size: 0.75rem;
      }
    }

    .switch-view {
      flex: 1;
    }

    .preview-orientation {
      font-size: 1.25rem;
      padding: 0.25rem 0.5rem;
    }

    .auto-refresh {
      font-size: 1.5rem;
      padding: 0.25rem 0.5rem;
      opacity: 0.5;

      &.toggled {
        opacity: 1;
      }
    }
  }

  .footer-buttons button {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
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
