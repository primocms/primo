<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();

  import {Spinner} from '../misc'

  export let variants = ''
  export let type = 'button'
  export let disabled = false
  export let loading = false
</script>

<button class="save-button {variants}" class:disabled={disabled || loading} disabled={disabled || loading} on:click={(e) => dispatch('click', e)} {type}>
  {#if loading}
    <Spinner />
  {:else}
    <slot></slot>
  {/if}
</button>

<style>
  .save-button {
    @apply bg-primored text-white py-2 px-4 rounded font-semibold transition-colors duration-200;
  }

  .save-button:hover {
      @apply bg-red-700;
    }

    .save-button.disabled {
      @apply bg-gray-600 text-gray-900;
    }
</style>