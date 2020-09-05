<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  export let active = false
</script>

<button class:bg-gray-700={active} class="flex items-center px-3 py-2 border rounded-sm text-teal-200 border-teal-400 hover:text-white hover:border-white" on:click={() => dispatch('click')}>
  <svg class="fill-current h-3 w-3" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><title>Menu</title><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"/></svg>
</button>

<style>
  button {
    @apply transition-colors duration-200;
  }
</style>