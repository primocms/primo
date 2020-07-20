<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();

  export let id = null
  export let label
  export let options
  export let selection = options[0]
  export let variants = ''

  $: dispatch('select', selection)


</script>

<div class={variants} {id}>
  <span class="text-base text-gray-900 font-semibold">{label}</span>
  <div class="toggle">
    {#each options as option}
      <button class:selected={selection === option} type="button" on:click={() => selection = option}>{option}</button>
    {/each}
  </div>
</div>

<style>
  .toggle {
    @apply flex mt-1 rounded-sm overflow-hidden;
  }
  .toggle > button {
    @apply flex-1 bg-gray-100 text-gray-700 py-2 font-medium transition-colors duration-200;
  }
  .toggle > button.selected {
    @apply bg-gray-800 text-gray-100 transition-colors duration-200 outline-none;
  }
</style>