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
  <div class="field is-horizontal">
    <div class="field-label">
      <label class="label" for={field.id}>{ field.label }</label>
    </div>
    <div class="flex justify-between items-center">
      <div class="field">
        <p class="control">
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
        </p>
      </div>
    </div>
  </div>
{:else}
  <div class="field">
    <label class="label">{ field.label }
      <div class="control">
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
      </div>
    </label>
  </div>
{/if}

