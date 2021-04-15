<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import {IconButton} from '../misc'
  import _ from 'lodash'

  export let disabled = false

  const dispatch = createEventDispatcher();

</script>


<div class="subfield" in:fade={{ duration: 100 }}>
  <div class="select">
    <slot name="type"></slot>
  </div>
  <div class="input-group">
    <span class="input-group-label">
      Label
    </span>
    <div class="input-group-input">
      <slot name="label"></slot>
    </div>
  </div>
  <div class="input-group">
    <span class="input-group-label">
      ID
    </span>
    <div class="input-group-input">
      <slot name="key"></slot>
    </div>
  </div>
  <IconButton icon="times" variants="is-danger is-outlined" on:click={() => dispatch('delete')} {disabled} />
</div>

<style>
  .subfield {
    @apply flex w-full px-3 py-2 items-center text-sm;
  }
  .select {
    @apply mr-2;
  }
  .input-group {
    @apply flex flex-1 items-center;
  }
  .input-group-label {
    @apply p-2 font-semibold;
  }
  .input-group-input {
      @apply mr-4 flex-1 flex;
    }
  :global(.input-group-input input) {
        @apply flex-1 outline-none border-b border-gray-200 transition-colors duration-200;
      }
      :global(.input-group-input input:focus) {
          @apply border-primored;
        }

</style>
