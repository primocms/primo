<script>
  import { onMount, onDestroy } from 'svelte'
  import _ from 'lodash'
  import { get, set } from 'idb-keyval';
  import { BroadcastChannel } from 'broadcast-channel';
  import { fade } from 'svelte/transition'
  import {wrapInStyleTags} from './utils'
  import {appendHtml} from './views/editor/pageUtils.js'

  let id = ''
  let html = ''
  let css = ''
  let js = ''

  get('preview').then(data => {
    id = data.id
    html = data.html 
    css = data.css 
    js = data.js
  })
  $: set('preview', { id, html, css, js })

  var BC = new BroadcastChannel('preview');
  BC.onmessage = ({data}) => {
    id = data.id
    html = data.html 
    css = data.css 
    js = data.js
  }

  let tailwindStyles = ''
  get('tailwind').then(t => {
    tailwindStyles = t
    BC.postMessage('ready')
  })

  async function setPageJs(js) {
    appendHtml(
      `[primo-js]`, 
      'script', 
      js,
      {
        type: 'module'
      }
    )
  }

  let mounted = false
  onMount(() => mounted = true)
  $: mounted && setPageJs(js)

</script>

<svelte:head>
  {@html wrapInStyleTags(tailwindStyles)}
  {@html wrapInStyleTags(css)}
</svelte:head>

{#if html}
  <div class="primo-page" in:fade={{ duration: 100 }} id="component-{id}">
    {@html html}
  </div>
{:else}
  <div id="primo-empty-state" in:fade={{ duration: 100 }}></div>
{/if}
<div primo-js></div>

<style global>

  .primo-page {
    @apply w-full h-full;
  }
  
</style>