<script>
  import { onMount } from 'svelte'
  import { get, set } from 'idb-keyval';
  import { BroadcastChannel } from 'broadcast-channel';
  import Spinner from '../components/misc/Spinner.svelte'
  import {wrapInStyleTags} from '../utils'

  let pages = []

  get('site-preview').then(data => pages = data)

  var BC = new BroadcastChannel('site-preview');
  BC.onmessage = (data) => pages = data

  let tailwindStyles = ''
  get('tailwind').then(t => {
    tailwindStyles = t
  })

</script>

{#if tailwindStyles}
  {#each pages as page}
    <div class="primo-page">
      {@html page.html}
    </div>
  {/each}
{:else}
  <div class="bg-black h-screen w-screen absolute top-0 left-0">
    <Spinner />
  </div>
{/if}

<svelte:head>
  {@html wrapInStyleTags(tailwindStyles)}
</svelte:head>

<style>
  .primo-page {
    @apply border-b-4 border-gray-800;
  }
</style>