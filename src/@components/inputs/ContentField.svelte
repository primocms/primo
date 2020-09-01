<script lang="ts">
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import type {Field} from '../../types/components'

  const dispatch = createEventDispatcher();

  export let field:Field

  export let disabled:boolean = false
  export let title:null|string = null;
  export let horizontal:boolean = false;

  let isCheckbox:boolean
  $: isCheckbox = field.type === 'checkbox' 

  function onInput({ target }): void {
    field.value = isCheckbox ? target.checked : target.value;
    dispatch('input')
  }

</script>

{#if horizontal}
  <div class="">
    <label class="label text-xl font-medium" for={field.id}>{ field.label }</label>
    <div class="flex justify-between items-center">
      {#if isCheckbox}
        <input 
          {title}
          {disabled}
          id={field.id}
          type="checkbox" 
          checked={field.value} 
          on:input={onInput}
        >
      {:else}
        <input 
          class="input"
          {title}
          {disabled}
          id={field.id}
          type={field.type} 
          checked={field.value}
          value={field.value} 
          on:input={onInput} 
        >
      {/if}
    </div>
  </div>
{:else}
  <div class="">
    <label class="flex flex-col text-xl font-medium">
      <span class="mb-2">{ field.label }</span>
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
  </div>
{/if}

<style>
  input {
    outline-color: rgb(248,68,73);
    @apply bg-gray-100 p-2;
  }
</style>