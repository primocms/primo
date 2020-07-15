<script>
  import {createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  const dispatch = createEventDispatcher()
  export let subdomain

  let siteName = `${subdomain.id}.${window.location.host}`
</script>

<div class="text-lg flex flex-row justify-between py-4 my-4 shadow-sm px-6 transition-colors duration-200" in:fade={{ duration:100 }}>
  <a class="font-semibold text-blue-500 hover:text-blue-600" href="http://{siteName}">{subdomain.id}</a>
  <div>
    <button on:click={() => dispatch('invite')} class="text-xs underline text-blue-900 px-2">Invite</button>
    <button on:click={() => dispatch('delete')} class="text-xs underline text-red-900 px-2">Delete</button>
  </div>
</div>