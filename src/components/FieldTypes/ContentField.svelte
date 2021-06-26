<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let field;

  export let value = null;
  export let disabled = false;
  export let title = null;
  export let variants = '';

</script>

<label class="flex flex-col text-xl font-medium {variants}">
  <span class="mb-2 text-sm">{field.label}</span>
  {#if value}
    <input class="input" {title} {disabled} type="text" bind:value on:input />
  {:else}
    <input
      class="input"
      {title}
      {disabled}
      type="text"
      bind:value={field.value}
      on:input />
  {/if}
</label>

<style>
  input {
    @apply bg-gray-800 p-2;
  }

</style>
