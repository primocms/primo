<script>
  import {onMount,onDestroy} from 'svelte'
  import { set } from 'idb-keyval';
  import { BroadcastChannel } from 'broadcast-channel';

  export let multiple = false
  export let pages = null
  export let id = ''
  export let html = ''
  export let css = ''
  export let js = ''
  export let view = 'small'
  export let loading = false

  const BC = new BroadcastChannel('preview');

  let ready = false
  BC.onmessage = ({data}) => {
    ready = true
  }

  $: !multiple && ready && BC.postMessage({ id, html, css, js })
  $: multiple && ready && BC.postMessage(pages)

  let iframe

  let timeout
  let cachedJs = js // reload the iframe whenever js changes to wipe the page's memory
  $: if (cachedJs !== js) {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      iframe.contentWindow.location.reload()
    }, 1000)
  }

  let container
  let iframeLoaded = false

  function resizePreview() {
    if (view) {
      const {clientWidth:parentWidth} = container
      const {clientWidth:childWidth} = iframe
      const scaleRatio = parentWidth / childWidth
      iframe.style.transform = `scale(${scaleRatio})`
      iframe.style.height = (100 / scaleRatio) + '%'
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
          iframe.style.transform = 'scale(1)'
          iframe.style.height = '100%'
          view = 'small'
        }

      setTimeout(() => {
        iframe.classList.add('fadein')
      }, 400)

    }, 100)
  }

  let interval
  onMount(() => {
    interval = setInterval(resizePreview, 500); // TODO: Do this better
  })
  onDestroy(() => {
    set('preview', { html: '', css: '', js: '' })
    clearInterval(interval)
  })

</script>

<div class="h-full flex flex-col lg:pl-2">
  <div class="preview-container flex-1" class:loading bind:this={container}>
    <iframe class:scaled={view === 'large'} on:load={() => iframeLoaded = true} class:fadein={iframeLoaded} title="Preview HTML" src="/preview.html?preview={multiple ? 'multiple' : 'single' }" class="bg-white w-full h-full" bind:this={iframe}></iframe>
  </div>
  <div class="footer-buttons">
    {#if view === 'small'}
      <button class="switch-view" on:click={changeView}>
        <i class="fas fa-expand-arrows-alt"></i>
        <span>window view</span>
      </button>
    {:else if view === 'large'}
      <button class="switch-view" on:click={changeView}>
        <i class="fas fa-compress-arrows-alt"></i>
        <span>contained view</span>
      </button>
    {/if}
    <a target="blank" class="separate-tab" href="/preview.html">
      <span>preview in separate tab</span>
      <span class="icon ml-1">
        <i class="fas fa-external-link-alt"></i>
      </span>
    </a>
  </div>
</div>

<svelte:window on:resize={resizePreview} />

<style>
  iframe {
    @apply opacity-0 w-full transition-opacity duration-100 border-0;
  }
  iframe.scaled {
    width: 100vw;
    transform-origin: top left;
  }
  .fadein {
    @apply opacity-100 duration-200;
  }
  .preview-container {
    will-change: border-color;
    @apply border-4 border-solid transition-colors duration-500 overflow-hidden;
    border-bottom: 0;
    &.loading {
      border-color: rgb(248,68,73);
      & + .preview-html {
        @apply bg-primored text-white;
      }
    }
  }
  .footer-buttons  {
    @apply flex flex-wrap;

    a, button {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      min-width: 12rem;
      @apply flex-1 outline-none bg-gray-200 border-gray-300 border text-gray-600 text-xs py-2 block text-center transition-colors duration-100;
      &:hover {
        @apply bg-gray-300;
      }
    }
  }
</style>