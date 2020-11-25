<script>
  import { onMount, onDestroy } from 'svelte'
  import _ from 'lodash'
  import { get } from 'idb-keyval';
  import { fade } from 'svelte/transition'
  import {wrapInStyleTags} from './utils'
  
  export let previewId

  var BC = new BroadcastChannel(`preview-${previewId}`);

  let id = '' 
  let html = '' 
  let css = '' 
  let js = ''

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

</script>

<svelte:head>
  {@html wrapInStyleTags(tailwindStyles)}
  {@html wrapInStyleTags(css)}
</svelte:head>

<div class="primo-page" in:fade={{ duration: 100 }}>
  {@html html}
</div>

<style global>

  .primo-page {
    @apply w-full h-full;
  }
  
</style>