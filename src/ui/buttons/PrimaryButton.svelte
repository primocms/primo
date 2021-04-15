<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();
  import Spinner from '../misc/Spinner.svelte'

  export let id = null
  export let variants = ''
  export let type = 'button'
  export let loading = false
  export let disabled = false
</script>

<button {id} class="primary-button {variants}" {disabled} on:click={(e) => dispatch('click', e)} {type}>
  {#if loading}
     <Spinner />
  {:else}
    <slot></slot>
  {/if}
</button>

<style>
  .primary-button {
    @apply w-full text-gray-300 bg-gray-800 py-2 rounded-bl rounded-br font-medium transition-colors duration-100;
  }
  .primary-button:hover {
      @apply bg-gray-900;
    }
    .primary-button[disabled] {
      @apply bg-gray-500 pointer-events-none;
    }
</style>