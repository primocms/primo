<script lang="ts">
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import type {Field} from '../../types/components'

  const dispatch = createEventDispatcher();

  export let field:Field

  export let disabled:boolean = false
  export let title:null|string = null;

  let isCheckbox:boolean
  $: isCheckbox = field.type === 'checkbox' 

  function onInput({ target }): void {
    field.value = isCheckbox ? target.checked : target.value;
    dispatch('input')
  }

</script>

<label class="flex flex-col text-xl font-medium p-4 shadow-sm bg-white">
  <span class="mb-2 text-sm">{ field.label }</span>
  {#if isCheckbox}
    <input 
      {title}
      {disabled}
      type="checkbox" 
      checked={field.value} 
      on:input={onInput}
    >
  {:else}
    <input 
      class="input"
      {title}
      {disabled}
      type={field.type} 
      checked={field.value}
      value={field.value} 
      on:input={onInput} 
    >
  {/if}
</label>

<style>
  input {
    outline-color: rgb(248,68,73);
    @apply bg-gray-100 p-2;
  }
</style>