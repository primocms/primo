<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import _ from 'lodash'

  export let variants = 'text-sm'
  export let disabled = false
  export let isFirst = false
  export let isLast = false

  const dispatch = createEventDispatcher();

  function moveItem(direction) {
    dispatch('move', direction)
  }

</script>


<div class="field-container {variants}" in:fade={{ duration: 100 }}>
  <div class="rounded-sm flex items-center">
    <slot name="type"></slot>
  </div>
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label class="flex flex-col flex-1">
    <span class="font-semibold text-xs">Label</span>
    <slot name="label"></slot>
  </label>
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <div class="field">
    <label class="flex flex-col flex-1">
      <span class="font-semibold text-xs">ID</span>
      <slot name="key"></slot>
    </label>
  </div>
  <div class="py-1 px-2 text-gray-300 bg-gray-900 z-10 rounded flex items-center justify-end">
    <button class="mr-1" disabled={isFirst} title="Move up" on:click={() => moveItem('up')}>
      <i class="fas fa-arrow-up"></i>
    </button>
    <button class="mr-2" disabled={isLast} title="Move down" on:click={() => moveItem('down')}>
      <i class="fas fa-arrow-down"></i>
    </button>
    <button on:click={() => dispatch('delete')} {disabled} class="text-gray-500 transition-colors duration-100 hover:text-gray-400 focus:text-gray-400 rounded-sm" title="delete field">
      <i class="fas fa-trash"></i>
    </button>
  </div>
</div>

<style>
  .field-container {
    @apply grid p-2 gap-4;
    @screen md {
      grid-template-columns: auto 1fr 1fr auto;
    }

    select {
      @apply w-full;
    }
  }
  button[disabled] {
    @apply text-gray-700 cursor-default;
  }
  span {
    @apply text-gray-300;
  }
</style>