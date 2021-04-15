<!-- <svelte:options tag='block-buttons' /> -->
<script>
  import {code, trash, edit} from '../../../components/svg/small'

  import { createEventDispatcher } from "svelte"
  import {fade} from 'svelte/transition' 
  import { content } from '../../../stores/app/activePage';
  import {switchEnabled} from '../../../stores/app'
  const dispatch = createEventDispatcher()

  export let i
  export let optionsAbove
  export let optionsBelow
  export let node = null

  export let editable

  const iconStyles = `width:15px;position: relative;top: 1px;fill:#f7fafc;`

  $: isFirst = i === 0
  $: isLast = i === $content.length -1

</script>

<div in:fade={{ duration: 100 }} class="block-buttons" class:editable bind:this={node}>
  <div class="top">
    {#if editable}
      <div class="left-0 flex">
        <button on:click={() => dispatch('edit')} class="border-r border-red-500 px-3 ">
          {#if $switchEnabled}
            {@html code(iconStyles)}    
          {:else}
            {@html edit(iconStyles)}    
          {/if}
          <span class="ml-2">Edit</span>
        </button>
        <button on:click={() => dispatch('delete')} class="rounded-br px-3 ">
          {@html trash(`${iconStyles}`)}    
        </button>
      </div>
    {/if}
    <div class="absolute right-0 flex">
      {#if !isFirst}
        <button class="rounded-bl border-r border-red-500 px-2" on:click={() => dispatch('moveUp')} >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>
        </button>
      {/if}
      {#if !optionsAbove}
        <button on:click={() => dispatch('addOptionsAbove')} class="px-4" class:rounded-bl={isFirst}>
          <!-- {@html chevron(iconStyles)}     -->
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>
        </button>
      {/if}
    </div>
  </div>
  <div class="bottom flex right-0">
    {#if !isLast}
      <button class="rounded-tl border-r border-red-500 px-2" on:click={() => dispatch('moveDown')} >
        <svg class="w-5 h-5 transform rotate-180" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>
      </button>
    {/if}
    {#if !optionsBelow}
      <button on:click={() => dispatch('addOptionsBelow')} class="px-4" class:rounded-tl={isLast}>
        <!-- {@html chevron(`${iconStyles}transform: scaleY(-1)`)}     -->
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>
      </button>
    {/if}
  </div>
</div>

<style>

  .block-buttons {
    @apply z-10 absolute top-0 left-0 right-0 bottom-0 pointer-events-none ring-inset ring-4 ring-primored;
  }

  button {
    pointer-events: all;
    @apply focus:outline-none shadow-lg flex justify-center items-center h-8 bg-primored text-sm font-medium text-gray-100 transition-colors duration-100;

    &:hover {
      @apply bg-red-600;
    }
  }

  .top {
    @apply absolute left-0 right-0 top-0 w-full flex justify-between;
  }

  .bottom {
    @apply absolute bottom-0 w-full flex justify-end;
  }

</style>