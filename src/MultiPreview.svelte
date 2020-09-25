<script>
  import { onMount, onDestroy } from 'svelte'
  import {getHeadStyles,getPageLibraries,setHeadScript,setPageJsLibraries,appendHtml,setCustomScripts} from './views/editor/pageUtils.js'
  import store from './libraries/store.js'

  let pages = []

  var bc = new BroadcastChannel('preview');

  bc.postMessage('ready')

  bc.onmessage = ({data}) => {
    pages = data
    data.forEach((page, i) => {
      setIframeHeight(i)
      store.set(`preview-${i}`, {
        html: page.html,
        css: page.css
      }) 
    })
  }

  function setIframeHeight(i) {
    const iframe = iframes[i]
    if (iframe) {
      const iframeHeight = iframe.contentWindow.document.body.scrollHeight // offset border to prevent scrolling
      iframeHeights[i] = iframeHeight
      iframeHeights = iframeHeights // trigger reactivity
    }
  }

  let iframeLoaded = false
  let iframes = []
  let iframeHeights = []
  
</script>

<div>
{#if pages}
  {#each pages as page, i}
    <div class="preview-container" style="height:{iframeHeights[i]}px">
      <iframe bind:this={iframes[i]} class:fadein={iframeLoaded}  on:load={() => {iframeLoaded = true; setIframeHeight(i)}} title="Preview HTML" src="/preview.html?preview=single&page={i}"></iframe>
    </div>
  {/each}
{/if}
</div>


<style>
  iframe {
    @apply opacity-0 h-full w-full transition-opacity duration-100;
  }
  iframe.scaled {
    width: 100vw;
    transform-origin: top left;
  }
  .fadein {
    @apply opacity-100 duration-200;
  }

  .preview-container {
    outline: 0.25rem solid #edf2f7;
  }

  iframe {
    width: 100%;
    height: 100%;
  }
</style>