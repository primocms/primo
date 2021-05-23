<script>

  import { onMount, onDestroy } from 'svelte'
  import { set } from 'idb-keyval'
  import {isEqual} from 'lodash'
  import { BroadcastChannel } from 'broadcast-channel'
  import {iframePreview} from './misc'
  import {onMobile} from '../../stores/app/misc'

  export let id = ''
  export let html = ''
  export let css = ''
  export let js = ''
  export let tailwind = {}
  export let view = 'small'
  export let loading = false
  export let hideControls = false

  // used in separate tab preview
  const BC = new BroadcastChannel('preview')
  $: BC.postMessage({ id, html, css, js })
  $: set('preview', { id, html, css, js })

  let iframe
  let previewLoaded = false
  $: if (iframe) {
    iframe.contentWindow.addEventListener("message", ({data}) => {
      if (data === 'done') {
        previewLoaded = true
      }
    });
  }

  let container
  let iframeLoaded = false

  function resizePreview() {
    if (view) {
      const { clientWidth: parentWidth } = container
      const { clientWidth: childWidth } = iframe
      const scaleRatio = parentWidth / childWidth
      iframe.style.transform = `scale(${scaleRatio})`
      iframe.style.height = 100 / scaleRatio + '%'
    }
  }

  function changeView() {
    iframe.classList.remove('fadein')
    setTimeout(() => {
      if (view === 'small') {
        view = 'large'
        // clientWidth doesn't compute right without this
        setTimeout(resizePreview, 100)
      } else {
        iframe.classList.remove('fadein')
        iframe.style.transform = 'scale(1)'
        iframe.style.height = '100%'
        view = 'small'
      }
      setTimeout(() => {iframe.classList.add('fadein')}, 100)
    }, 100)
  }

  let interval
  onMount(() => {
    interval = setInterval(resizePreview, 500) 
  })
  onDestroy(() => {
    set('preview', { html: '', css: '', js: '' })
    clearInterval(interval)
  })

  // Necessary to reload tw config
  let cachedTailwind = tailwind
  $: resetIframe(tailwind)
  function resetIframe() {
    if (!isEqual(tailwind, cachedTailwind)) {
      cachedTailwind = tailwind
      iframeLoaded = false
    }
  }

  $: setIframeContent({ iframeLoaded, html, css, js, tailwind })
  function setIframeContent({ iframeLoaded, html, css, js, tailwind }) {
    if (iframeLoaded) {
      iframe.contentWindow.postMessage({ html, css, js, tailwind })
    }
  }


  function setLoading(e) {
    if (!iframeLoaded) {
      iframeLoaded = true
      return
    }
    iframeLoaded = false
    iframe.srcdoc = iframePreview
  }

</script>

<div class="h-full flex flex-col lg:pl-2">
  <div
    class="preview-container flex-1 bg-white"
    class:loading
    bind:this={container}
  >
    {#key JSON.stringify(tailwind)}
      <iframe
        class:scaled={view === 'large'}
        on:load={setLoading}
        class:fadein={previewLoaded}
        title="Preview HTML"
        srcdoc={iframePreview}
        class="bg-white w-full h-full"
        bind:this={iframe}
      />
    {/key}
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
      {#if !$onMobile}
        <a target="blank" class="separate-tab" href="/preview">
          <span>preview in separate tab</span>
          <span class="icon ml-1">
            <i class="fas fa-external-link-alt" />
          </span>
        </a>
      {/if}
    </div>
  {/if}
</div>

<svelte:window on:resize={resizePreview} />

<style>
  iframe {
    @apply w-full border-0 opacity-0 transition-opacity duration-300;
  }
  .fadein {
    @apply opacity-100 duration-300;
  }
  iframe.scaled {
    width: 100vw;
    transform-origin: top left;
  }
  .preview-container {
    will-change: border-color;
    @apply border-4 border-gray-800 transition-colors duration-200 overflow-hidden;
    border-bottom: 0;
  }
  .preview-container.loading {
    border-color: rgb(248, 68, 73);
  }
  .preview-container.loading + .preview-html {
    @apply bg-primored text-white;
  }
  .footer-buttons {
    @apply flex flex-wrap;
  }

  .footer-buttons a,
  .footer-buttons button {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    min-width: 12rem;
    @apply flex-1 outline-none bg-gray-900 border-gray-800 border text-gray-200 text-xs py-2 block text-center transition-colors duration-100;
  }
  .footer-buttons a:hover,
  .footer-buttons button:hover {
    @apply bg-gray-800;
  }
</style>
