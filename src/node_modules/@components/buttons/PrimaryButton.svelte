<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();

  export let id = null
  export let variants = ''
  export let type = 'button'
  export let disabled = false
</script>

<button {id} class="primary-button { disabled ? 'bg-gray-600' : 'bg-codeblack' } {variants}" {disabled} on:click={(e) => dispatch('click', e)} {type}><slot></slot></button>

<style>
  .primary-button {
    @apply w-full text-gray-300 py-2 rounded font-medium transition-colors duration-100;
    &:hover {
      @apply bg-gray-900 !important;
    }
  }
</style>