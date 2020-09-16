<script lang="ts">
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let field:Field

  export let disabled:boolean = false
  export let title:null|string = null;
  export let variants:string = ''

</script>

<label class="flex flex-col text-xl font-medium p-4 {variants}">
  <span class="mb-2 text-sm">{ field.label }</span>
  <input 
    class="input"
    {title}
    {disabled}
    type="text"
    value={field.value} 
    on:input={() => dispatch('input')} 
  >
</label>

<style>
  input {
    outline-color: rgb(248,68,73);
    @apply bg-white p-2;
  }
</style>