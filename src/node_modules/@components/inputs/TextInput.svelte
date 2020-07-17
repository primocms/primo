<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();

  export let id
  export let label
  export let prefix = ''
  export let value
  export let placeholder = ''
  export let variants = ''
  export let autofocus = false

  // Note: Svelte seems to have some issues with two-way binding, so if this is acting up it's probably that
</script>

<label class="flex flex-col items-start {variants}" {id}>
  {#if label}
     <span class="text-base mb-1 text-gray-900 font-semibold">{label}</span>
  {/if}
  <div class="flex items-normal w-full">
    {#if prefix}
      <span class="font-medium inline-block flex items-center mr-4 inline-block">{prefix}</span>
    {/if}
    <input {autofocus} bind:value type="text" {placeholder} class="inline-block flex-1" on:input={() => dispatch('input', value)} />
  </div>
</label>

<style>
  input {
    @apply text-base bg-gray-200 text-gray-900 font-medium rounded-sm py-2 px-3 flex-1;
  }
</style>