<svelte:options tag='component-buttons' />
<script>
  import {code, trash, chevron, edit} from '../../../components/svg/small'

  // // Workaround to get events firing https://github.com/sveltejs/svelte/issues/3119
  // import { createEventDispatcher } from "svelte"
  // import { get_current_component } from "svelte/internal"

  // const component = get_current_component()
  // const svelteDispatch = createEventDispatcher()
  // const dispatch = (name, detail) => {
  //   svelteDispatch(name, detail)
  //   component.dispatchEvent && component.dispatchEvent(new CustomEvent(name, { detail }))
  // }

  import { createEventDispatcher } from "svelte"
  const dispatch = createEventDispatcher()

  export let icon
  export let contentbelow
  export let contentabove
  export let node 

  const iconStyles = `width:13px;margin-right: 5px;position: relative;top: 1px;fill:#f7fafc;`
</script>

<div class="component-buttons" bind:this={node}>
  <button on:click={() => dispatch('edit')} id="component-edit">
    {#if icon === 'code'}
      {@html code(iconStyles)}    
    {:else}
      {@html edit(iconStyles)}    
    {/if}
    <span>Edit</span>
  </button>
  <button on:click={() => dispatch('delete')} id="component-remove">
    {@html trash(`${iconStyles} margin-right: 3px;`)}    
    <span>Remove</span>
  </button>
  {#if !contentabove}
    <button on:click={() => dispatch('addContentAbove')} id="component-add-row-above">
      {@html chevron(iconStyles)}    
      <span>Add Row Above</span>
    </button>
  {/if}
  {#if !contentbelow}
    <button on:click={() => dispatch('addContentBelow')} id="component-add-row-below">
      {@html chevron(`${iconStyles}transform: scaleY(-1);top:-3px;`)}    
      <span>Add Row Below</span>
    </button>
  {/if}
</div>

<style>

  .component-buttons {
    @apply flex flex-wrap;
    margin-bottom: -3px;
    margin-right: -3px;
  }

  button {
    pointer-events: all;
    @apply shadow-lg flex justify-center items-center px-2 h-6 bg-primored text-xs font-semibold text-gray-100 transition-colors duration-200;
    margin-right: 1px !important;
    margin-bottom: 1px !important;
    outline: none !important;
    &:last-child {
      border-bottom-right-radius: 5px !important;
    }
    &:hover {
      @apply bg-codeblack !important;
    }
  }
</style>