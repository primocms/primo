<script>
  import { onMount } from 'svelte'
  import { get, set } from 'idb-keyval';
  import { BroadcastChannel } from 'broadcast-channel';
  import { fade } from 'svelte/transition'
  import {wrapInStyleTags} from '../utils'
  import {appendHtml} from '../views/editor/pageUtils.js'
  import Spinner from '../components/misc/Spinner.svelte'

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

  var BC = new BroadcastChannel('preview');
  BC.onmessage = (data) => {
    if (data) {
      id = data.id
      html = data.html 
      css = data.css 
      js = data.js
    }
  }

  let tailwindStyles = ''
  get('tailwind').then(t => {
    tailwindStyles = t
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

{#if tailwindStyles}
  <div class="w-full h-full primo-page" in:fade={{ duration: 100 }} id="component-{id}">
    {#if id}
      <div id="component-{id}">
        {@html html}
      </div>
    {:else}
      {@html html}
    {/if}
  </div>
{:else}
  <div class="bg-black h-screen w-screen absolute top-0 left-0">
    <Spinner />
  </div>
{/if}
<div primo-js></div>

<svelte:head>
  {@html wrapInStyleTags(tailwindStyles)}
  {@html wrapInStyleTags(css)}
</svelte:head>