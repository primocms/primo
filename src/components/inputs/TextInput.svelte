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

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class="flex flex-col items-start text-gray-200 {variants}" {id}>
  {#if label}
     <span class="mb-1 text-gray-200 font-semibold">{label}</span>
  {/if}
  <div class="flex items-normal w-full">
    {#if prefix}
      <span class="font-medium flex items-center mr-4">{prefix}</span>
    {/if}
    <input {autofocus} bind:value type="text" {placeholder} class="inline-block flex-1" on:input={() => dispatch('input', value)} />
  </div>
</label>

<style>
  input {
    @apply bg-gray-800 text-gray-100 font-medium rounded-sm py-2 px-3 flex-1;
  }
</style>