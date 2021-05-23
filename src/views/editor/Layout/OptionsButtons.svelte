<svelte:options tag={null} />
<script>
  import {fade} from 'svelte/transition'
  import { createEventDispatcher, onMount } from "svelte"
  import ComponentPicker from './ComponentPicker/ComponentPicker.svelte'
  import {switchEnabled} from '../../../stores/app'

  const dispatch = createEventDispatcher()

  export let deletable = true
  let selectingComponent = false

</script>

{#if selectingComponent}
  <ComponentPicker 
    on:select={({detail:component}) => dispatch('select', component)}
    on:manage={() => dispatch('convert', 'symbol')}
    on:remove={() => dispatch('remove')}
  />
{:else}
  <div class="bg-codeblack border-t border-b border-gray-800">
    <div class="container mx-auto py-2 flex">
      <div class="w-8 flex items-center">
        <svg class="w-6 h-6 text-gray-100" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
      </div>
      <div class="flex-1 grid gap-2 grid-cols-2" class:grid-cols-3={deletable}>
        <button on:click={() => dispatch('convert', 'content')} class="is-primored" on:click={() => dispatch('delete')} id="component-remove">
          <i class="fas fa-edit"></i> 
          <span class="hidden md:inline">Content</span>
        </button>
        <button on:click={() => selectingComponent = true} class="is-primored" on:click={() => dispatch('delete')} id="component-remove">
          <i class="fas fa-clone"></i>  
          <span class="hidden md:inline">Component</span>
        </button>
        {#if deletable}
          <button on:click={() => dispatch('remove')} class="border border-gray-800 hover:bg-gray-800" on:click={() => dispatch('delete')} id="component-remove">
            <i class="fas fa-trash"></i>   
            <span class="hidden md:inline">Remove</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* @tailwind base;
  @tailwind components;
  @tailwind utilities; */

  i {
    @apply md:mr-2;
  }

  button {
    @apply focus:outline-none focus:ring-2 focus:ring-primored font-semibold flex-1 rounded-sm flex justify-center items-center px-2 text-sm text-gray-100 transition-colors duration-200;
  
    &.is-primored {
      @apply bg-primored hover:bg-red-600 py-2;
    }
  }
</style>