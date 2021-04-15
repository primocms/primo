<script>
  import { BroadcastChannel } from 'broadcast-channel';

  let pages = []

  const BC = new BroadcastChannel('preview');
  let ready = false

  BC.onmessage = ({data}) => {
    pages = data
  }
  BC.postMessage('ready')

  $: {
    const LastPreviewBC = new BroadcastChannel(`preview-${pages.length-1}`);
    LastPreviewBC.onmessage = () => {
      ready = true
    }
  }

  $: ready && pages.forEach((page, i) => {
    const SingleBC = new BroadcastChannel(`preview-${i}`);
    SingleBC.postMessage({
      html: page.html,
      css: page.css
    }) 
    setTimeout(() => {setIframeHeight(i)}, 500)
  })

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
        <iframe bind:this={iframes[i]} class:opacity-100={iframeLoaded} class="opacity-0 h-full w-full transition-opacity duration-100 border-0" on:load={() => {iframeLoaded = true; setIframeHeight(i)}} title="Preview HTML" src="/preview.html?preview=single&page={i}"></iframe>
      </div>
    {/each}
  {/if}
</div>


<style>
  iframe {
    width: 100%;
    height: 100%;
  }
</style>