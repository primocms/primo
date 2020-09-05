<script lang="ts">
  import {onMount} from 'svelte'
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import {IconButton} from '../misc'
  import _ from 'lodash'

  export let variants:string = 'text-sm'
  export let disabled:boolean = false

  const dispatch = createEventDispatcher();

</script>


<div class="field-container {variants}" in:fade={{ duration: 100 }}>
  <div class="rounded-sm border border-gray-100">
    <slot name="type"></slot>
  </div>
  <label class="flex flex-col flex-1">
    <span class="font-semibold text-xs">Label</span>
    <slot name="label"></slot>
  </label>
  <div class="field">
    <label class="flex flex-col flex-1">
      <span class="font-semibold text-xs">ID</span>
      <slot name="key"></slot>
    </label>
  </div>
  <button on:click={() => dispatch('delete')} {disabled} class="px-4 py-2 bg-gray-100 text-gray-600 transition-colors duration-100 hover:bg-gray-300 focus:bg-gray-300" title="delete field">
    <i class="fas fa-times"></i>
  </button>
</div>

<style>
  .field-container {
    @apply grid p-2 gap-8;
    grid-template-columns: auto 1fr 1fr auto;
  }
</style>