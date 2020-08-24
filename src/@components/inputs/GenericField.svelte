<script>
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import {InfoTooltip} from '../misc'

  const dispatch = createEventDispatcher();

  export let label = null;
  export let value = '';
  export let leftlabel = null;
  export let input = null;
  export let info = null;
  export let title = null;
  export let disabled

  function onInput({ target }) {
    dispatch('input')
    value = target.value
  }

</script>

<div class="field" class:is-horizontal={leftlabel}>
  {#if leftlabel}
    <div class="field-label is-normal">
      <label class="label" {title}>
        {leftlabel}
        {#if info}
          <InfoTooltip />
        {/if}
      </label>
    </div>
  {/if}
  <div class="field-body">
    <div class="field is-expanded" class:has-addons={label}>
      {#if label}
        <p class="control">
          <span class="button is-static">
            {label}
          </span>
        </p>
      {/if}
      <p class="control is-expanded">
        {#if input}
          <input class="input" {...input} on:input={onInput} {value} {disabled}> 
        {:else}
          <slot></slot>
        {/if}
      </p>
    </div>
  </div>
</div>
